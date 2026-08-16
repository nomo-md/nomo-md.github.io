import { createWriteStream } from 'node:fs';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(projectRoot, 'dist');
const repository = 'nomo-md/nomo';
const githubApi = `https://api.github.com/repos/${repository}`;
const pagesFileLimit = 25 * 1024 * 1024;
const releaseNotesPattern = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\.md$/;
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });

const assetKinds = [
  {
    key: 'windows-installer',
    platform: 'windows',
    label: 'Windows 安装版',
    action: '下载 EXE',
    detail: '安装后接入系统卸载入口。',
    pattern: /^Nomo_\d+\.\d+\.\d+_x64-setup\.exe$/i,
  },
  {
    key: 'windows-portable',
    platform: 'windows',
    label: 'Windows 免安装版',
    action: '下载 ZIP',
    detail: '解压即用，不会注册 .md 文件关联。',
    pattern: /^Nomo_\d+\.\d+\.\d+_x64\.zip$/i,
  },
  {
    key: 'macos-dmg',
    platform: 'macos',
    label: 'macOS 磁盘映像',
    action: '下载 DMG',
    detail: '用于 Apple Silicon（arm64）设备。',
    pattern: /^Nomo_\d+\.\d+\.\d+_aarch64\.dmg$/i,
  },
  {
    key: 'macos-archive',
    platform: 'macos',
    label: 'macOS 应用压缩包',
    action: '下载 TAR.GZ',
    detail: '解压后获得 Nomo.app。',
    pattern: /^Nomo_(?:\d+\.\d+\.\d+_)?aarch64\.app\.tar\.gz$/i,
  },
];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'nomo-pages-build',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub 请求失败：${response.status} ${url}`);
  }

  return response.json();
}

async function loadReleaseNotes() {
  const localDirectory = process.env.NOMO_RELEASE_NOTES_DIR
    ? path.resolve(process.env.NOMO_RELEASE_NOTES_DIR)
    : path.resolve(projectRoot, '..', 'nomo', '.github', 'release-notes');

  if (await exists(localDirectory)) {
    const names = (await readdir(localDirectory)).filter((name) => releaseNotesPattern.test(name));
    return Promise.all(
      names.map(async (name) => ({
        name,
        content: await readFile(path.join(localDirectory, name), 'utf8'),
      })),
    );
  }

  const files = await fetchJson(`${githubApi}/contents/.github/release-notes?ref=master`);
  const noteFiles = files.filter((file) => file.type === 'file' && releaseNotesPattern.test(file.name));

  return Promise.all(
    noteFiles.map(async (file) => {
      const response = await fetch(file.download_url, { headers: { 'User-Agent': 'nomo-pages-build' } });
      if (!response.ok) throw new Error(`下载发布说明失败：${file.name}`);
      return { name: file.name, content: await response.text() };
    }),
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(dateText) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(dateText));
}

function prepareReleaseNote(content) {
  return content
    .replace(/^##\s+安装包\s*$[\s\S]*$/im, '')
    .replace(
      /<img\b[^>]*\balt=["']([^"']*)["'][^>]*\bsrc=["']([^"']+)["'][^>]*\/?\s*>/gi,
      '![$1]($2)',
    )
    .trim();
}

function compareVersions(leftTag, rightTag) {
  const parse = (tag) => {
    const [version, suffix = ''] = tag.replace(/^v/, '').split('-', 2);
    return { numbers: version.split('.').map(Number), suffix };
  };
  const left = parse(leftTag);
  const right = parse(rightTag);

  for (let index = 0; index < 3; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) {
      return right.numbers[index] - left.numbers[index];
    }
  }
  if (!left.suffix && right.suffix) return -1;
  if (left.suffix && !right.suffix) return 1;
  return right.suffix.localeCompare(left.suffix, 'zh-CN', { numeric: true });
}

function resolveAssets(release) {
  return assetKinds.map((kind) => {
    const matches = release.assets.filter((asset) => kind.pattern.test(asset.name));
    if (matches.length !== 1) {
      throw new Error(`${release.tag_name} 的 ${kind.label} 应有且仅有一个，实际为 ${matches.length} 个`);
    }

    const asset = matches[0];
    if (asset.size >= pagesFileLimit) {
      throw new Error(`${asset.name} 为 ${formatBytes(asset.size)}，达到或超过 Pages 的 25 MiB 单文件限制`);
    }

    return { ...asset, ...kind };
  });
}

async function downloadAsset(asset, destination) {
  const response = await fetch(asset.browser_download_url, {
    headers: { Accept: 'application/octet-stream', 'User-Agent': 'nomo-pages-build' },
    redirect: 'follow',
  });
  if (!response.ok || !response.body) {
    throw new Error(`下载安装包失败：${asset.name} (${response.status})`);
  }

  await mkdir(path.dirname(destination), { recursive: true });
  await pipeline(response.body, createWriteStream(destination));
}

function renderDownloadRows(assets, tag, platform) {
  return assets
    .filter((asset) => asset.platform === platform)
    .map((asset) => {
      const href = `/downloads/${encodeURIComponent(tag)}/${encodeURIComponent(asset.name)}`;
      return `
        <article class="package-row" data-kind="${asset.key}">
          <div class="package-description">
            <h3>${escapeHtml(asset.label)}</h3>
            <p>${escapeHtml(asset.detail)}</p>
          </div>
          <div class="package-meta">
            <span>${escapeHtml(formatBytes(asset.size))}</span>
            <code>${escapeHtml(asset.name)}</code>
          </div>
          <a class="package-action" href="${href}" download>
            <span>${escapeHtml(asset.action)}</span>
            <span aria-hidden="true">↓</span>
          </a>
        </article>`;
    })
    .join('\n');
}

function renderReleaseHistory(notes, releases) {
  const releaseByTag = new Map(releases.map((release) => [release.tag_name, release]));
  const items = notes
    .map((note) => ({ tag: note.name.slice(0, -3), content: prepareReleaseNote(note.content) }))
    .filter((note) => releaseByTag.has(note.tag))
    .sort((left, right) => compareVersions(left.tag, right.tag));

  return items
    .map((note, index) => {
      const release = releaseByTag.get(note.tag);
      const badge = release.prerelease ? '<span class="release-badge">测试版</span>' : '';
      const body = note.content ? markdown.render(note.content) : '';
      return `
        <details class="release-entry" id="${escapeHtml(note.tag)}"${index === 0 ? ' open' : ''}>
          <summary>
            <span class="release-version">${escapeHtml(note.tag)} ${badge}</span>
            <span class="release-date">${escapeHtml(formatDate(release.published_at))}</span>
          </summary>
          <div class="release-body prose">
            ${body}
            <a class="release-source" href="${escapeHtml(release.html_url)}" target="_blank" rel="noreferrer">在 GitHub 查看此版本</a>
          </div>
        </details>`;
    })
    .join('\n');
}

async function renderTemplate(sourcePath, destinationPath, replacements) {
  let html = await readFile(sourcePath, 'utf8');
  for (const [token, value] of Object.entries(replacements)) {
    html = html.replaceAll(`{{${token}}}`, value);
  }
  if (/{{[A-Z0-9_]+}}/.test(html)) throw new Error(`${sourcePath} 仍有未替换的模板变量`);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, html, 'utf8');
}

async function main() {
  const [latestRelease, releases, notes] = await Promise.all([
    fetchJson(`${githubApi}/releases/latest?build=${Date.now()}`),
    fetchJson(`${githubApi}/releases?per_page=100&build=${Date.now()}`),
    loadReleaseNotes(),
  ]);

  if (latestRelease.draft || latestRelease.prerelease) {
    throw new Error(`GitHub latest 返回的 ${latestRelease.tag_name} 不是稳定版本`);
  }

  const assets = resolveAssets(latestRelease);
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });

  await Promise.all([
    cp(path.join(projectRoot, 'assets'), path.join(outputRoot, 'assets'), { recursive: true }),
    cp(path.join(projectRoot, 'styles.css'), path.join(outputRoot, 'styles.css')),
    cp(path.join(projectRoot, 'script.js'), path.join(outputRoot, 'script.js')),
    cp(path.join(projectRoot, 'robots.txt'), path.join(outputRoot, 'robots.txt')),
    cp(path.join(projectRoot, 'sitemap.xml'), path.join(outputRoot, 'sitemap.xml')),
    ...assets.map((asset) =>
      downloadAsset(asset, path.join(outputRoot, 'downloads', latestRelease.tag_name, asset.name)),
    ),
  ]);

  const homepage = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
  await writeFile(
    path.join(outputRoot, 'index.html'),
    homepage.replace(/"softwareVersion":\s*"[^"]+"/, `"softwareVersion": "${latestRelease.tag_name.slice(1)}"`),
    'utf8',
  );

  await renderTemplate(path.join(projectRoot, 'download', 'index.html'), path.join(outputRoot, 'download', 'index.html'), {
    LATEST_TAG: escapeHtml(latestRelease.tag_name),
    RELEASE_DATE: escapeHtml(formatDate(latestRelease.published_at)),
    WINDOWS_DOWNLOADS: renderDownloadRows(assets, latestRelease.tag_name, 'windows'),
    MACOS_DOWNLOADS: renderDownloadRows(assets, latestRelease.tag_name, 'macos'),
  });

  await renderTemplate(path.join(projectRoot, 'releases', 'index.html'), path.join(outputRoot, 'releases', 'index.html'), {
    LATEST_TAG: escapeHtml(latestRelease.tag_name),
    RELEASE_HISTORY: renderReleaseHistory(notes, releases.filter((release) => !release.draft)),
  });

  const latestManifest = {
    tag: latestRelease.tag_name,
    version: latestRelease.tag_name.slice(1),
    releasedAt: latestRelease.published_at,
    assets: assets.map((asset) => ({
      kind: asset.key,
      platform: asset.platform,
      name: asset.name,
      size: asset.size,
      url: `/downloads/${latestRelease.tag_name}/${asset.name}`,
    })),
  };
  await writeFile(
    path.join(outputRoot, 'downloads', 'latest.json'),
    `${JSON.stringify(latestManifest, null, 2)}\n`,
    'utf8',
  );

  console.log(`Built ${latestRelease.tag_name}: ${assets.length} installers, ${notes.length} release-note files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

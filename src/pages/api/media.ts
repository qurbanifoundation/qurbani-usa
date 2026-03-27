export const prerender = false;

import type { APIRoute } from 'astro';

// Lazy-loaded Node.js modules (not available on Cloudflare Workers)
let _fs: any = null;
let _path: any = null;
let _execSync: any = null;
let _loaded = false;

async function loadNodeModules() {
  if (_loaded) return { fs: _fs, path: _path, execSync: _execSync };
  _loaded = true;
  try {
    const fsModule = await import('node:fs');
    _fs = fsModule.default || fsModule;
    const pathModule = await import('node:path');
    _path = pathModule.default || pathModule;
    const cpModule = await import('node:child_process');
    _execSync = cpModule.execSync || cpModule.default?.execSync;
  } catch {
    // Cloudflare Workers — no fs
  }
  return { fs: _fs, path: _path, execSync: _execSync };
}

// Aliases used throughout the file
let fs: any, path: any, execSync: any;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

function getImagesDir(): string {
  return path.join(process.cwd(), 'public', 'images');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function getImageInfo(imagesDir: string, filename: string) {
  const filePath = path.join(imagesDir, filename);
  const stats = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();

  return {
    name: filename,
    path: '/images/' + filename,
    url: '/images/' + filename,
    size: stats.size,
    sizeFormatted: formatSize(stats.size),
    extension: ext.replace('.', ''),
    modified: stats.mtime.toISOString(),
    hasWebp: ext !== '.webp' && ext !== '.svg'
      ? fs.existsSync(path.join(imagesDir, filename.replace(ext, '.webp')))
      : null,
  };
}

// ─── GET: List all images ───────────────────────────────────────────────────────

export const GET: APIRoute = async () => {
  const mods = await loadNodeModules();
  fs = mods.fs; path = mods.path; execSync = mods.execSync;

  try {
    if (!fs || !path) {
      // Production fallback: scan database for all image URLs
      try {
        const { supabaseAdmin } = await import('../../lib/supabase');
        const imageSet = new Map<string, { url: string; name: string; extension: string; usedOn: string[] }>();

        // Scan campaigns
        const { data: campaigns } = await supabaseAdmin
          .from('campaigns')
          .select('slug, name, featured_image, donation_options')
          .eq('is_active', true);

        if (campaigns) {
          for (const c of campaigns) {
            const label = c.name || c.slug;
            if (c.featured_image) {
              const url = c.featured_image;
              const name = url.startsWith('/images/') ? url.replace('/images/', '') : url.split('/').pop() || url;
              const ext = name.split('.').pop()?.toLowerCase() || '';
              if (!imageSet.has(url)) imageSet.set(url, { url, name, extension: ext, usedOn: [] });
              imageSet.get(url)!.usedOn.push(label + ' (hero)');
            }
            if (Array.isArray(c.donation_options)) {
              for (const opt of c.donation_options) {
                if (opt.image) {
                  const url = opt.image;
                  const name = url.startsWith('/images/') ? url.replace('/images/', '') : url.split('/').pop() || url;
                  const ext = name.split('.').pop()?.toLowerCase() || '';
                  if (!imageSet.has(url)) imageSet.set(url, { url, name, extension: ext, usedOn: [] });
                  const ref = label + ' (option)';
                  if (!imageSet.get(url)!.usedOn.includes(ref)) imageSet.get(url)!.usedOn.push(ref);
                }
              }
            }
          }
        }

        // Scan menu widgets
        const { data: widgets } = await supabaseAdmin
          .from('menu_widgets')
          .select('id, menu_id, config');

        if (widgets) {
          for (const w of widgets) {
            const configStr = JSON.stringify(w.config || {});
            const imgMatches = configStr.match(/\/images\/[^"',\s}]+/g);
            if (imgMatches) {
              for (const url of imgMatches) {
                const name = url.replace('/images/', '');
                const ext = name.split('.').pop()?.toLowerCase() || '';
                if (!imageSet.has(url)) imageSet.set(url, { url, name, extension: ext, usedOn: [] });
                imageSet.get(url)!.usedOn.push('Menu: ' + w.menu_id);
              }
            }
          }
        }

        // Scan site settings
        const { data: settings } = await supabaseAdmin
          .from('site_settings')
          .select('*')
          .limit(1);

        if (settings && settings[0]) {
          for (const [key, val] of Object.entries(settings[0])) {
            if (typeof val === 'string' && val.startsWith('/images/')) {
              const name = val.replace('/images/', '');
              const ext = name.split('.').pop()?.toLowerCase() || '';
              if (!imageSet.has(val)) imageSet.set(val, { url: val, name, extension: ext, usedOn: [] });
              imageSet.get(val)!.usedOn.push('Settings: ' + key);
            }
          }
        }

        // Also list files from Supabase Storage 'media' bucket
        try {
          const { data: storageFiles } = await supabaseAdmin.storage
            .from('media')
            .list('', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });

          if (storageFiles) {
            for (const file of storageFiles) {
              if (!file.name || file.name === '.emptyFolderPlaceholder') continue;
              const ext = file.name.split('.').pop()?.toLowerCase() || '';
              if (!['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) continue;
              const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(file.name);
              const publicUrl = urlData?.publicUrl || '';
              if (!imageSet.has(publicUrl)) {
                imageSet.set(publicUrl, {
                  url: publicUrl,
                  name: file.name,
                  extension: ext,
                  usedOn: ['Supabase Storage (uploaded)'],
                });
              }
            }
          }
        } catch (storageErr: any) {
          console.error('Supabase Storage list error:', storageErr.message);
        }

        const images = Array.from(imageSet.values()).map(img => ({
          ...img,
          path: img.url,
          size: 0,
          sizeFormatted: 'N/A',
          modified: new Date().toISOString(),
          hasWebp: null,
        }));

        const availableTypes = [...new Set(images.map(i => i.extension))].sort();

        return new Response(JSON.stringify({
          images,
          total: images.length,
          totalSizeFormatted: 'N/A (production mode)',
          availableTypes,
          productionMode: true,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({
          images: [],
          total: 0,
          error: 'Failed to scan database: ' + e.message,
          localOnly: true,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const files = fs.readdirSync(imagesDir);

    const images = files
      .filter((f) => {
        const filePath = path.join(imagesDir, f);
        return fs.statSync(filePath).isFile() && isImageFile(f);
      })
      .map((f) => getImageInfo(imagesDir, f))
      .sort((a, b) => b.modified.localeCompare(a.modified));

    const totalSize = images.reduce((sum, img) => sum + img.size, 0);

    // Collect available file types (only types that actually exist)
    const availableTypes = [...new Set(images.map(img => img.extension))].sort();

    // Scan for image usage across campaigns and source files
    let usageMap: Record<string, string[]> = {};
    try {
      // 1. Check campaigns in DB for featured_image references
      const { supabaseAdmin } = await import('../../lib/supabase');
      const { data: campaigns } = await supabaseAdmin
        .from('campaigns')
        .select('slug, name, featured_image, donation_options, template_config')
        .eq('is_active', true);

      if (campaigns) {
        for (const c of campaigns) {
          const campaignLabel = c.name || c.slug;
          const slug = c.slug;
          // Check featured_image
          if (c.featured_image && c.featured_image.startsWith('/images/')) {
            const imgName = c.featured_image.replace('/images/', '');
            if (!usageMap[imgName]) usageMap[imgName] = [];
            usageMap[imgName].push(campaignLabel + ' (hero) [slug:' + slug + ']');
          }
          // Check donation_options images
          if (Array.isArray(c.donation_options)) {
            for (const opt of c.donation_options) {
              if (opt.image && opt.image.startsWith('/images/')) {
                const imgName = opt.image.replace('/images/', '');
                if (!usageMap[imgName]) usageMap[imgName] = [];
                const label = campaignLabel + ' (gift/option) [slug:' + slug + ']';
                if (!usageMap[imgName].includes(label)) {
                  usageMap[imgName].push(label);
                }
              }
            }
          }
        }
      }

      // 2. Scan source files for image references
      const srcDir = path.join(process.cwd(), 'src');
      const scanDirs = ['templates', 'pages', 'components'];
      for (const dir of scanDirs) {
        const fullDir = path.join(srcDir, dir);
        if (!fs.existsSync(fullDir)) continue;
        const scanFiles = (d: string) => {
          const entries = fs.readdirSync(d, { withFileTypes: true });
          for (const entry of entries) {
            const fp = path.join(d, entry.name);
            if (entry.isDirectory()) { scanFiles(fp); continue; }
            if (!entry.name.match(/\.(astro|ts|tsx|js)$/)) continue;
            try {
              const content = fs.readFileSync(fp, 'utf-8');
              for (const img of images) {
                if (content.includes(img.name)) {
                  const relPath = fp.replace(srcDir, 'src');
                  if (!usageMap[img.name]) usageMap[img.name] = [];
                  if (!usageMap[img.name].includes(relPath)) {
                    usageMap[img.name].push(relPath);
                  }
                }
              }
            } catch {}
          }
        };
        scanFiles(fullDir);
      }
    } catch (e) {
      console.error('Usage scan error:', e);
    }

    // Attach usage info to each image
    const imagesWithUsage = images.map(img => ({
      ...img,
      usedOn: usageMap[img.name] || [],
      isUsed: (usageMap[img.name] || []).length > 0,
    }));

    return new Response(
      JSON.stringify({
        images: imagesWithUsage,
        total: imagesWithUsage.length,
        totalSize,
        totalSizeFormatted: formatSize(totalSize),
        availableTypes,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Media API GET error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// ─── POST: Convert / Upload / Upload-URL ────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  const mods = await loadNodeModules();
  fs = mods.fs; path = mods.path; execSync = mods.execSync;

  const isProduction = !fs || !path;

  try {
    const contentType = request.headers.get('content-type') || '';

    // ── Production: Supabase Storage upload ─────────────────────────────────
    if (isProduction) {
      if (contentType.includes('multipart/form-data')) {
        return await handleSupabaseUpload(request);
      }
      const body = await request.json();
      if (body.action === 'replace-refs') {
        return await handleReplaceRefs(body);
      }
      if (body.action === 'upload-url') {
        return await handleSupabaseUploadUrl(body);
      }
      if (body.action === 'delete') {
        return await handleSupabaseDelete(body);
      }
      return new Response(JSON.stringify({ error: 'This operation is only available in local development' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── Local: Filesystem operations ────────────────────────────────────────
    const imagesDir = getImagesDir();

    if (contentType.includes('multipart/form-data')) {
      return await handleUpload(request, imagesDir);
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'convert':
        return await handleConvert(body, imagesDir);
      case 'upload-url':
        return await handleUploadUrl(body, imagesDir);
      case 'delete':
        return await handleDelete(body, imagesDir);
      case 'replace-with-webp':
        return await handleReplaceWithWebp(body, imagesDir);
      case 'replace-refs':
        return await handleReplaceRefs(body);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (e: any) {
    console.error('Media API POST error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// ─── Convert to WebP ────────────────────────────────────────────────────────────

async function handleConvert(
  body: { filename: string; quality?: number },
  imagesDir: string
): Promise<Response> {
  const { filename, quality = 80 } = body;

  if (!filename) {
    return new Response(JSON.stringify({ error: 'filename is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const inputPath = path.join(imagesDir, filename);
  if (!fs.existsSync(inputPath)) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ext = path.extname(filename).toLowerCase();
  if (ext === '.webp') {
    return new Response(JSON.stringify({ error: 'File is already WebP' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (ext === '.svg') {
    return new Response(JSON.stringify({ error: 'Cannot convert SVG to WebP' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const webpFilename = filename.replace(/\.(png|jpg|jpeg|gif)$/i, '.webp');
  const outputPath = path.join(imagesDir, webpFilename);

  try {
    // Try sharp module first
    let sharp: any;
    try {
      sharp = (await import('sharp')).default;
    } catch {
      // sharp not available as module
    }

    if (sharp) {
      await sharp(inputPath).webp({ quality }).toFile(outputPath);
    } else {
      // Fallback to sharp-cli
      const clampedQuality = Math.min(100, Math.max(1, quality));
      execSync(
        `npx sharp-cli -i "${inputPath}" -o "${outputPath}" --format webp --quality ${clampedQuality}`,
        { timeout: 30000, stdio: 'pipe' }
      );
    }

    if (!fs.existsSync(outputPath)) {
      return new Response(
        JSON.stringify({ error: 'Conversion failed - output file not created' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const info = getImageInfo(imagesDir, webpFilename);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Converted ${filename} to WebP`,
        original: filename,
        converted: info,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Conversion error:', err);
    return new Response(
      JSON.stringify({ error: 'Conversion failed: ' + err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── File Upload ────────────────────────────────────────────────────────────────

async function handleUpload(
  request: Request,
  imagesDir: string
): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const convertToWebp = formData.get('convertToWebp') === 'true';
  const quality = parseInt(formData.get('quality') as string) || 80;

  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isImageFile(file.name)) {
    return new Response(
      JSON.stringify({ error: 'Invalid file type. Allowed: ' + IMAGE_EXTENSIONS.join(', ') }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'File too large. Maximum 10MB.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sanitized = sanitizeFilename(file.name);
  const filePath = path.join(imagesDir, sanitized);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const result: Record<string, any> = {
    success: true,
    message: `Uploaded ${sanitized}`,
    file: getImageInfo(imagesDir, sanitized),
  };

  // Optionally convert to webp
  if (convertToWebp) {
    const ext = path.extname(sanitized).toLowerCase();
    if (ext !== '.webp' && ext !== '.svg') {
      const convertResponse = await handleConvert(
        { filename: sanitized, quality },
        imagesDir
      );
      const convertResult = await convertResponse.json();
      if (convertResult.success) {
        result.converted = convertResult.converted;
        result.message += ` and converted to WebP`;
      }
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Upload from URL ────────────────────────────────────────────────────────────

async function handleUploadUrl(
  body: { url: string; filename?: string; convertToWebp?: boolean; quality?: number },
  imagesDir: string
): Promise<Response> {
  const { url, convertToWebp = false, quality = 80 } = body;

  if (!url) {
    return new Response(JSON.stringify({ error: 'URL is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return new Response(
        JSON.stringify({ error: 'URL does not point to an image (content-type: ' + contentType + ')' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine filename
    let filename = body.filename || '';
    if (!filename) {
      const urlPath = new URL(url).pathname;
      filename = path.basename(urlPath) || 'downloaded-image.png';
    }

    // Ensure extension
    if (!path.extname(filename)) {
      const extMap: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'image/svg+xml': '.svg',
      };
      filename += extMap[contentType] || '.png';
    }

    const sanitized = sanitizeFilename(filename);
    const filePath = path.join(imagesDir, sanitized);

    const buffer = Buffer.from(await response.arrayBuffer());

    // 10MB limit
    if (buffer.length > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Downloaded file too large. Maximum 10MB.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    fs.writeFileSync(filePath, buffer);

    const result: Record<string, any> = {
      success: true,
      message: `Downloaded and saved ${sanitized}`,
      file: getImageInfo(imagesDir, sanitized),
    };

    // Optionally convert to webp
    if (convertToWebp) {
      const ext = path.extname(sanitized).toLowerCase();
      if (ext !== '.webp' && ext !== '.svg') {
        const convertResponse = await handleConvert(
          { filename: sanitized, quality },
          imagesDir
        );
        const convertResult = await convertResponse.json();
        if (convertResult.success) {
          result.converted = convertResult.converted;
          result.message += ` and converted to WebP`;
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('URL download error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to download: ' + err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ─── Delete Image ───────────────────────────────────────────────────────────────

async function handleDelete(
  body: { filename: string },
  imagesDir: string
): Promise<Response> {
  const { filename } = body;

  if (!filename) {
    return new Response(JSON.stringify({ error: 'filename is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const filePath = path.join(imagesDir, filename);
  if (!fs.existsSync(filePath)) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  fs.unlinkSync(filePath);

  return new Response(
    JSON.stringify({ success: true, message: `Deleted ${filename}` }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// ─── Replace with WebP: Convert + Update all DB references ──────────────────

async function handleReplaceWithWebp(body: any, imagesDir: string) {
  const { filename, quality = 80 } = body;
  if (!filename) {
    return new Response(JSON.stringify({ error: 'filename required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const ext = path.extname(filename).toLowerCase();
  if (ext === '.webp' || ext === '.svg') {
    return new Response(JSON.stringify({ error: 'Already WebP or SVG' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const inputPath = path.join(imagesDir, filename);
  if (!fs.existsSync(inputPath)) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const webpFilename = filename.replace(/\.(png|jpg|jpeg|gif)$/i, '.webp');
  const outputPath = path.join(imagesDir, webpFilename);
  const oldUrl = '/images/' + filename;
  const newUrl = '/images/' + webpFilename;

  // 1. Convert to WebP (if not already exists)
  if (!fs.existsSync(outputPath)) {
    try {
      execSync(`npx sharp-cli -i "${inputPath}" -o "${outputPath}" -f webp -q ${quality}`, {
        timeout: 30000,
        stdio: 'pipe',
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: 'Conversion failed: ' + e.message }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 2. Update all DB references
  const updatedRefs: string[] = [];
  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    // Update campaigns.featured_image
    const { data: featuredCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, featured_image')
      .eq('featured_image', oldUrl);

    if (featuredCampaigns && featuredCampaigns.length > 0) {
      await supabaseAdmin
        .from('campaigns')
        .update({ featured_image: newUrl })
        .eq('featured_image', oldUrl);
      updatedRefs.push(`${featuredCampaigns.length} campaign hero image(s)`);
    }

    // Update campaigns.donation_options (JSONB array with image fields)
    const { data: allCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, donation_options')
      .not('donation_options', 'is', null);

    if (allCampaigns) {
      for (const c of allCampaigns) {
        if (!Array.isArray(c.donation_options)) continue;
        let changed = false;
        const updatedOptions = c.donation_options.map((opt: any) => {
          if (opt.image === oldUrl) {
            changed = true;
            return { ...opt, image: newUrl };
          }
          return opt;
        });
        if (changed) {
          await supabaseAdmin
            .from('campaigns')
            .update({ donation_options: updatedOptions })
            .eq('id', c.id);
          updatedRefs.push(`${c.slug} donation options`);
        }
      }
    }

    // Update menu_widgets configs
    const { data: widgets } = await supabaseAdmin
      .from('menu_widgets')
      .select('id, config');

    if (widgets) {
      for (const w of widgets) {
        const configStr = JSON.stringify(w.config || {});
        if (configStr.includes(oldUrl)) {
          const updatedConfig = JSON.parse(configStr.replace(new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newUrl));
          await supabaseAdmin
            .from('menu_widgets')
            .update({ config: updatedConfig })
            .eq('id', w.id);
          updatedRefs.push('menu widget');
        }
      }
    }

    // Update site_settings (logo, favicon etc)
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .limit(1);

    if (settings && settings[0]) {
      const settingsStr = JSON.stringify(settings[0]);
      if (settingsStr.includes(oldUrl)) {
        const updates: Record<string, string> = {};
        for (const [key, val] of Object.entries(settings[0])) {
          if (typeof val === 'string' && val === oldUrl) {
            updates[key] = newUrl;
          }
        }
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin
            .from('site_settings')
            .update(updates)
            .eq('id', 'main');
          updatedRefs.push('site settings');
        }
      }
    }
  } catch (e: any) {
    console.error('DB update error:', e);
    // Still return success for conversion, note DB update failure
    return new Response(
      JSON.stringify({
        success: true,
        converted: webpFilename,
        newUrl,
        oldUrl,
        warning: 'Converted but failed to update some DB references: ' + e.message,
        updatedRefs,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  const webpSize = fs.statSync(outputPath).size;
  const origSize = fs.statSync(inputPath).size;

  return new Response(
    JSON.stringify({
      success: true,
      converted: webpFilename,
      newUrl,
      oldUrl,
      originalSize: formatSize(origSize),
      webpSize: formatSize(webpSize),
      savings: Math.round((1 - webpSize / origSize) * 100) + '%',
      updatedRefs,
      message: `Converted and updated ${updatedRefs.length} reference(s)`,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// ─── Supabase Storage Upload (Production) ───────────────────────────────────

async function handleSupabaseUpload(request: Request) {
  const { supabaseAdmin } = await import('../../lib/supabase');
  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return new Response(JSON.stringify({ error: 'File too large (max 10MB)' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Sanitize filename
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
  const timestamp = Date.now();
  const storagePath = `${timestamp}-${sanitized}`;

  const buffer = await file.arrayBuffer();

  // Upload to Supabase Storage 'media' bucket
  const { data, error } = await supabaseAdmin.storage
    .from('media')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return new Response(JSON.stringify({ error: 'Upload failed: ' + error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from('media')
    .getPublicUrl(storagePath);

  const publicUrl = urlData?.publicUrl || '';

  return new Response(JSON.stringify({
    success: true,
    filename: sanitized,
    url: publicUrl,
    size: file.size,
    sizeFormatted: formatSize(file.size),
    message: 'Uploaded to Supabase Storage. Use the URL in your campaigns.',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSupabaseUploadUrl(body: any) {
  const { url, filename } = body;
  if (!url) {
    return new Response(JSON.stringify({ error: 'URL required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { supabaseAdmin } = await import('../../lib/supabase');

  // Fetch the image
  const res = await fetch(url);
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Failed to fetch image from URL' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/png';
  const ext = contentType.includes('webp') ? '.webp' : contentType.includes('jpeg') || contentType.includes('jpg') ? '.jpg' : '.png';
  const sanitized = (filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
  const storagePath = `${Date.now()}-${sanitized}${ext}`;

  const { error } = await supabaseAdmin.storage
    .from('media')
    .upload(storagePath, buffer, { contentType, upsert: false });

  if (error) {
    return new Response(JSON.stringify({ error: 'Upload failed: ' + error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: urlData } = supabaseAdmin.storage.from('media').getPublicUrl(storagePath);

  return new Response(JSON.stringify({
    success: true,
    filename: sanitized + ext,
    url: urlData?.publicUrl || '',
    message: 'Uploaded from URL to Supabase Storage.',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleSupabaseDelete(body: any) {
  const { filename } = body;
  if (!filename) {
    return new Response(JSON.stringify({ error: 'Filename required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Only delete from Supabase Storage (not static /images/ files)
  if (!filename.includes('supabase')) {
    return new Response(JSON.stringify({ error: 'Can only delete Supabase-hosted images from production. Static images must be deleted locally.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract storage path from URL
  const { supabaseAdmin } = await import('../../lib/supabase');
  const storagePath = filename.split('/media/')[1] || filename;

  const { error } = await supabaseAdmin.storage.from('media').remove([storagePath]);
  if (error) {
    return new Response(JSON.stringify({ error: 'Delete failed: ' + error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, message: 'Deleted from Supabase Storage' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Replace Refs: Swap one image for another in all DB references ──────────

async function handleReplaceRefs(body: any) {
  const { oldFilename, newFilename } = body;
  if (!oldFilename || !newFilename) {
    return new Response(JSON.stringify({ error: 'oldFilename and newFilename required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const oldUrl = '/images/' + oldFilename;
  const newUrl = '/images/' + newFilename;
  const updatedRefs: string[] = [];

  try {
    const { supabaseAdmin } = await import('../../lib/supabase');

    // Update campaigns.featured_image
    const { data: featuredCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug')
      .eq('featured_image', oldUrl);

    if (featuredCampaigns && featuredCampaigns.length > 0) {
      await supabaseAdmin
        .from('campaigns')
        .update({ featured_image: newUrl })
        .eq('featured_image', oldUrl);
      featuredCampaigns.forEach((c: any) => updatedRefs.push(c.slug + ' (hero)'));
    }

    // Update campaigns.donation_options images
    const { data: allCampaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, donation_options')
      .not('donation_options', 'is', null);

    if (allCampaigns) {
      for (const c of allCampaigns) {
        if (!Array.isArray(c.donation_options)) continue;
        let changed = false;
        const updatedOptions = c.donation_options.map((opt: any) => {
          if (opt.image === oldUrl) {
            changed = true;
            return { ...opt, image: newUrl };
          }
          return opt;
        });
        if (changed) {
          await supabaseAdmin
            .from('campaigns')
            .update({ donation_options: updatedOptions })
            .eq('id', c.id);
          updatedRefs.push(c.slug + ' (options)');
        }
      }
    }

    // Update menu_widgets
    const { data: widgets } = await supabaseAdmin
      .from('menu_widgets')
      .select('id, config');

    if (widgets) {
      for (const w of widgets) {
        const configStr = JSON.stringify(w.config || {});
        if (configStr.includes(oldUrl)) {
          const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const updatedConfig = JSON.parse(configStr.replace(new RegExp(escaped, 'g'), newUrl));
          await supabaseAdmin
            .from('menu_widgets')
            .update({ config: updatedConfig })
            .eq('id', w.id);
          updatedRefs.push('menu widget');
        }
      }
    }

    // Update site_settings
    const { data: settings } = await supabaseAdmin
      .from('site_settings')
      .select('*')
      .limit(1);

    if (settings && settings[0]) {
      const updates: Record<string, string> = {};
      for (const [key, val] of Object.entries(settings[0])) {
        if (typeof val === 'string' && val === oldUrl) {
          updates[key] = newUrl;
        }
      }
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('site_settings')
          .update(updates)
          .eq('id', 'main');
        updatedRefs.push('site settings');
      }
    }
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: 'Failed to update references: ' + e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      oldUrl,
      newUrl,
      updatedRefs,
      message: updatedRefs.length > 0
        ? `Replaced ${oldFilename} with ${newFilename} in ${updatedRefs.length} location(s): ${updatedRefs.join(', ')}`
        : `No DB references found for ${oldFilename}. Note: source code references (.astro files) need manual updates.`,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

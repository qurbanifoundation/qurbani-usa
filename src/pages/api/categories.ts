import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabase';
import { clearCategoriesCache } from '../../lib/categories';
import { clearNavbarCache } from '../../lib/menus';

export const prerender = false;

// GET all categories
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('sort_order');

    if (error) throw error;

    return new Response(JSON.stringify(data || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// POST create new category
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert([{
        slug: body.slug,
        label: body.label,
        color: body.color || '#01534d',
        icon: body.icon || 'heart',
        description: body.description || null,
        is_active: body.is_active !== false,
        show_in_menu: body.show_in_menu !== false,
        sort_order: body.sort_order || 0,
      }])
      .select()
      .single();

    if (error) throw error;

    // Clear cache after create
    clearCategoriesCache();
    clearNavbarCache();

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// PUT update category
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If slug is changing, we need to cascade the change to all campaigns and campaign_pages
    let oldSlug: string | null = null;
    let newSlug: string | null = null;

    if (updateData.slug) {
      // Get the current category slug before updating
      const { data: currentCat } = await supabaseAdmin
        .from('categories')
        .select('slug')
        .eq('id', id)
        .single();

      if (currentCat && currentCat.slug !== updateData.slug) {
        oldSlug = currentCat.slug;
        newSlug = updateData.slug;
      }
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Cascade slug change to campaigns, campaign_pages, and mega menu widgets
    if (oldSlug && newSlug) {
      const cascadeResults = await cascateCategorySlugChange(id, oldSlug, newSlug);
      console.log(`Category slug cascade: "${oldSlug}" → "${newSlug}"`, cascadeResults);
    }

    // Clear cache after update
    clearCategoriesCache();
    clearNavbarCache();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * Cascade a category slug change to all dependent records:
 * 1. campaigns.category (text field storing slug)
 * 2. campaigns.url_path (e.g., /old-slug/campaign-slug → /new-slug/campaign-slug)
 * 3. campaign_pages.url_path (linked by category_id FK)
 * 4. mega_menu widget URLs in config JSONB
 */
async function cascateCategorySlugChange(categoryId: string, oldSlug: string, newSlug: string) {
  const results = { campaigns: 0, campaignPages: 0, menuWidgets: 0, errors: [] as string[] };

  // 1. Update campaigns: change category text field and url_path
  try {
    // Get all campaigns with the old category slug
    const { data: campaigns } = await supabaseAdmin
      .from('campaigns')
      .select('id, slug, category, url_path')
      .eq('category', oldSlug);

    if (campaigns && campaigns.length > 0) {
      for (const campaign of campaigns) {
        const newUrlPath = `/${newSlug}/${campaign.slug}`;
        const { error } = await supabaseAdmin
          .from('campaigns')
          .update({
            category: newSlug,
            url_path: newUrlPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', campaign.id);

        if (error) {
          results.errors.push(`Campaign ${campaign.slug}: ${error.message}`);
        } else {
          results.campaigns++;
        }
      }
    }
  } catch (e: any) {
    results.errors.push(`Campaigns batch: ${e.message}`);
  }

  // 2. Update campaign_pages: they use category_id FK, so just update url_path
  try {
    const { data: pages } = await supabaseAdmin
      .from('campaign_pages')
      .select('id, slug, url_path, category_id')
      .eq('category_id', categoryId);

    if (pages && pages.length > 0) {
      for (const page of pages) {
        const newUrlPath = `/${newSlug}/${page.slug}`;
        const { error } = await supabaseAdmin
          .from('campaign_pages')
          .update({
            url_path: newUrlPath,
            updated_at: new Date().toISOString()
          })
          .eq('id', page.id);

        if (error) {
          results.errors.push(`Page ${page.slug}: ${error.message}`);
        } else {
          results.campaignPages++;
        }
      }
    }
  } catch (e: any) {
    results.errors.push(`Campaign pages batch: ${e.message}`);
  }

  // 3. Update mega menu widget URLs in config JSONB
  try {
    const { data: widgets } = await supabaseAdmin
      .from('menu_widgets')
      .select('id, config, widget_type');

    if (widgets) {
      for (const widget of widgets) {
        if (!widget.config) continue;
        const configStr = JSON.stringify(widget.config);
        // Check if this widget has any URLs containing the old category slug
        if (configStr.includes(`/${oldSlug}/`)) {
          const updatedConfigStr = configStr.replaceAll(`/${oldSlug}/`, `/${newSlug}/`);
          const updatedConfig = JSON.parse(updatedConfigStr);
          const { error } = await supabaseAdmin
            .from('menu_widgets')
            .update({ config: updatedConfig })
            .eq('id', widget.id);

          if (error) {
            results.errors.push(`Widget ${widget.id}: ${error.message}`);
          } else {
            results.menuWidgets++;
          }
        }
      }
    }
  } catch (e: any) {
    results.errors.push(`Menu widgets: ${e.message}`);
  }

  return results;
}

// DELETE category
export const DELETE: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Clear cache after delete
    clearCategoriesCache();
    clearNavbarCache();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

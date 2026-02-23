import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

// Default content based on page type/slug
function getDefaultContent(page: any) {
  const title = page.title || 'Page Title';
  const slug = page.slug || '';

  // Home page
  if (slug === '/' || slug === '' || title.toLowerCase() === 'home') {
    return {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'A Muslim Charity Serving Humanity',
          subtitle: '100% of your Zakat reaches those in need. Operating in 53+ countries since 1999.',
          backgroundImage: '',
          showButton: true,
          buttonText: 'Donate Now',
          buttonLink: '/donate'
        },
        {
          id: 'intro',
          type: 'content',
          content: '<h2>Welcome to Qurbani Foundation USA</h2><p>We are dedicated to alleviating suffering and providing humanitarian aid to communities in need around the world. Your donations help provide food, water, medical care, and education to those who need it most.</p>'
        },
        {
          id: 'cta',
          type: 'cta',
          title: 'Make a Difference Today',
          description: 'Your donation can change lives. Join us in our mission to help those in need.',
          buttonText: 'Donate Now',
          buttonLink: '/donate'
        }
      ]
    };
  }

  // About page
  if (slug.includes('about')) {
    return {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'About Us',
          subtitle: 'Learn about our mission, values, and the impact we make around the world.',
          backgroundImage: '',
          showButton: false,
          buttonText: '',
          buttonLink: ''
        },
        {
          id: 'mission',
          type: 'content',
          content: '<h2>Our Mission</h2><p>Qurbani Foundation USA is dedicated to providing humanitarian aid and relief to communities in need around the world. We believe in the power of compassion and the importance of helping those less fortunate.</p><h2>Our Values</h2><ul><li><strong>Integrity</strong> - 100% of Zakat donations go directly to those in need</li><li><strong>Transparency</strong> - We provide detailed reports on how donations are used</li><li><strong>Compassion</strong> - We treat every beneficiary with dignity and respect</li></ul>'
        }
      ]
    };
  }

  // Contact page
  if (slug.includes('contact')) {
    return {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Contact Us',
          subtitle: 'We would love to hear from you. Reach out with any questions.',
          backgroundImage: '',
          showButton: false,
          buttonText: '',
          buttonLink: ''
        },
        {
          id: 'info',
          type: 'content',
          content: '<h2>Get in Touch</h2><p>Have questions about our programs or want to learn more about how you can help?</p><h3>Office Address</h3><p>145 Sherwood Ave<br>Teaneck, NJ 07666</p><h3>Phone</h3><p>+1 (703) 596-4900<br>Toll Free: 1-800-900-0027</p><h3>Email</h3><p>info@qurbani.com</p>'
        }
      ]
    };
  }

  // Privacy/Terms pages
  if (slug.includes('privacy') || slug.includes('terms') || slug.includes('policy')) {
    return {
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: title,
          subtitle: '',
          backgroundImage: '',
          showButton: false,
          buttonText: '',
          buttonLink: ''
        },
        {
          id: 'content',
          type: 'content',
          content: `<h2>${title}</h2><p>Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p><p>Add your ${title.toLowerCase()} content here...</p>`
        }
      ]
    };
  }

  // Default for any other page
  return {
    sections: [
      {
        id: 'hero',
        type: 'hero',
        title: title,
        subtitle: 'Add your subtitle here',
        backgroundImage: '',
        showButton: true,
        buttonText: 'Learn More',
        buttonLink: '#'
      },
      {
        id: 'content-1',
        type: 'content',
        content: '<p>Start adding your content here...</p>'
      }
    ]
  };
}

// POST - Initialize content for all pages that don't have it
export const POST: APIRoute = async () => {
  try {
    // Get all pages
    const { data: pages, error: fetchError } = await supabaseAdmin
      .from('pages')
      .select('*');

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let updated = 0;
    let skipped = 0;

    for (const page of pages || []) {
      // Check if page has valid content
      let hasContent = false;
      if (page.content) {
        try {
          const parsed = typeof page.content === 'string' ? JSON.parse(page.content) : page.content;
          hasContent = parsed.sections && parsed.sections.length > 0;
        } catch (e) {
          hasContent = false;
        }
      }

      if (!hasContent) {
        // Update with default content
        const defaultContent = getDefaultContent(page);
        const { error: updateError } = await supabaseAdmin
          .from('pages')
          .update({ content: defaultContent })
          .eq('id', page.id);

        if (!updateError) {
          updated++;
        }
      } else {
        skipped++;
      }
    }

    // Also fix any double-slash slugs
    await supabaseAdmin
      .from('pages')
      .update({ slug: '/' })
      .or('slug.eq.,slug.is.null')
      .eq('title', 'Home');

    return new Response(JSON.stringify({
      success: true,
      message: `Initialized ${updated} pages, ${skipped} already had content`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to initialize pages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

UPDATE campaigns SET impact_stats = '[{"value":"14M+","label":"People Displaced"},{"value":"25M+","label":"Need Urgent Aid"},{"value":"5M+","label":"Children Affected"},{"value":"$50","label":"Feeds a Family"}]'::jsonb WHERE slug = 'sudan-emergency';

UPDATE campaigns SET donation_options = '[{"amount":50,"label":"Emergency food pack"},{"amount":100,"label":"Medical supplies"},{"amount":250,"label":"Family relief kit"},{"amount":500,"label":"Emergency shelter"},{"amount":1000,"label":"Community aid"},{"amount":2500,"label":"Major impact"}]'::jsonb WHERE slug = 'sudan-emergency';

UPDATE campaigns SET gallery_images = '["https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&q=80","https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80","https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=600&q=80"]'::jsonb WHERE slug = 'sudan-emergency';

UPDATE campaigns SET content_sections = '[{"title":"Emergency Food Distribution","content":"<p>Our teams distribute emergency food packages to families in need.</p>","image":"https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80"},{"title":"Medical Aid","content":"<p>Mobile medical units bring care directly to displaced communities.</p>","image":"https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80"},{"title":"Clean Water","content":"<p>We install water purification systems and distribute hygiene kits.</p>","image":"https://images.unsplash.com/photo-1594398901394-4e34939a4fd0?w=800&q=80"}]'::jsonb WHERE slug = 'sudan-emergency';

SELECT slug, name, page_template, impact_stats, donation_options FROM campaigns WHERE slug = 'sudan-emergency';

const GHL_API_KEY = "pit-d3aed288-7751-4255-9126-0649a26d7ff7";
const GHL_LOCATION_ID = "W0zaxipAVHwutqUazGwL";

async function checkPermissions() {
  console.log("=== TESTING GHL API PERMISSIONS ===\n");

  // Test 1: Get single contact
  console.log("1. Contacts Read:");
  const contact = await fetch("https://services.leadconnectorhq.com/contacts/gQAKwyheWPzyMxjO6YRJ", {
    headers: { "Authorization": "Bearer " + GHL_API_KEY, "Version": "2021-07-28" }
  });
  console.log("   Status:", contact.status, contact.status === 200 ? "✅" : "❌");
  if (contact.status === 200) {
    const data = await contact.json();
    console.log("   Custom Fields on contact:", data.contact?.customFields?.length || 0, "fields");
    if (data.contact?.customFields?.length > 0) {
      data.contact.customFields.forEach(f => {
        console.log("     -", f.id || f.key, ":", f.value || f.field_value);
      });
    }
  }

  // Test 2: Custom Fields Location (needs locations/customFields.readonly scope)
  console.log("\n2. Custom Fields (Location Settings):");
  const customFields = await fetch(`https://services.leadconnectorhq.com/locations/${GHL_LOCATION_ID}/customFields`, {
    headers: { "Authorization": "Bearer " + GHL_API_KEY, "Version": "2021-07-28" }
  });
  console.log("   Status:", customFields.status, customFields.status === 200 ? "✅" : "❌ (Need: locations/customFields.readonly)");

  // Test 3: Tags
  console.log("\n3. Tags Read:");
  const tags = await fetch(`https://services.leadconnectorhq.com/locations/${GHL_LOCATION_ID}/tags`, {
    headers: { "Authorization": "Bearer " + GHL_API_KEY, "Version": "2021-07-28" }
  });
  console.log("   Status:", tags.status, tags.status === 200 ? "✅" : "❌");

  console.log("\n=== REQUIRED SCOPES FOR FULL INTEGRATION ===");
  console.log("Current scopes (from earlier screenshot):");
  console.log("  ✅ contacts.readonly");
  console.log("  ✅ contacts.write");
  console.log("  ✅ locations/tags.readonly");
  console.log("  ✅ locations/tags.write");
  console.log("  ✅ opportunities.readonly");
  console.log("  ✅ opportunities.write");
  console.log("\nRecommended additional scopes:");
  console.log("  ➕ locations/customFields.readonly - To list custom fields");
  console.log("  ➕ locations/customFields.write - To create custom fields");
  console.log("  ➕ locations/customValues.readonly - To read custom field values");
  console.log("  ➕ locations/customValues.write - To write custom field values");
}

checkPermissions();

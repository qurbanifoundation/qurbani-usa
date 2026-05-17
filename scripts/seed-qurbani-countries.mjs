/**
 * Seed Qurbani Countries into campaign template_config
 *
 * Saves the 44 qurbani countries with pricing/animals into the
 * qurbani campaign's template_config.countries field so they can
 * be edited from admin without code changes.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const client = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const countries = [
  // MOST NEEDED - Emergency & Crisis Areas
  {
    id: 'palestine-gaza',
    name: 'Palestine Gaza',
    flag: '\u{1F1F5}\u{1F1F8}',
    image: 'https://images.unsplash.com/photo-1597933557903-44c26da20d5e?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 425 },
      { type: 'cow_share', label: 'Cow Share', price: 400 },
      { type: 'cow_full', label: 'Full Cow', price: 2800 },
    ],
    description: 'Support families in besieged Gaza',
    urgency: true,
    featured: true
  },
  {
    id: 'palestine-jerusalem',
    name: 'Palestine Jerusalem',
    flag: '\u{1F1F5}\u{1F1F8}',
    image: 'https://images.unsplash.com/photo-1549893072-4b6c95f3da45?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 325 },
      { type: 'cow_share', label: 'Cow Share', price: 300 },
      { type: 'cow_full', label: 'Full Cow', price: 2100 },
    ],
    description: 'Feed families in Al-Quds',
    urgency: true
  },
  {
    id: 'yemen',
    name: 'Yemen',
    flag: '\u{1F1FE}\u{1F1EA}',
    image: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'goat', label: 'Goat', price: 155 },
      { type: 'sheep', label: 'Sheep', price: 155 },
      { type: 'cow_share', label: 'Cow Share', price: 130 },
      { type: 'cow_full', label: 'Full Cow', price: 910 },
    ],
    description: 'Relief for famine-affected regions',
    urgency: true
  },
  {
    id: 'syria',
    name: 'Syria',
    flag: '\u{1F1F8}\u{1F1FE}',
    image: 'https://images.unsplash.com/photo-1580835845259-5c34e1b5b6bd?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 225 },
      { type: 'cow_share', label: 'Cow Share', price: 200 },
      { type: 'cow_full', label: 'Full Cow', price: 1400 },
    ],
    description: 'Aid for displaced Syrian families',
    urgency: true
  },
  {
    id: 'afghanistan',
    name: 'Afghanistan',
    flag: '\u{1F1E6}\u{1F1EB}',
    image: 'https://images.unsplash.com/photo-1587634741838-6a4a0a6a1a0e?w=400&q=80',
    category: ['most-needed'],
    animals: [
      { type: 'goat', label: 'Goat', price: 200 },
      { type: 'sheep', label: 'Sheep', price: 200 },
      { type: 'cow_share', label: 'Cow Share', price: 175 },
      { type: 'cow_full', label: 'Full Cow', price: 1225 },
    ],
    description: 'Help families facing economic hardship'
  },
  {
    id: 'iraq',
    name: 'Iraq',
    flag: '\u{1F1EE}\u{1F1F6}',
    image: 'https://images.unsplash.com/photo-1570939274717-7eda259b50ed?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 275 },
      { type: 'cow_share', label: 'Cow Share', price: 250 },
      { type: 'cow_full', label: 'Full Cow', price: 1750 },
    ],
    description: 'Rebuild communities in conflict zones',
    urgency: true
  },
  {
    id: 'iraq-refugees',
    name: 'Iraq Refugees',
    flag: '\u{1F1EE}\u{1F1F6}',
    image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 225 },
      { type: 'cow_share', label: 'Cow Share', price: 200 },
      { type: 'cow_full', label: 'Full Cow', price: 1400 },
    ],
    description: 'Support displaced Iraqi families',
    urgency: true
  },
  {
    id: 'sudan',
    name: 'Sudan',
    flag: '\u{1F1F8}\u{1F1E9}',
    image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'goat', label: 'Goat', price: 145 },
      { type: 'sheep', label: 'Sheep', price: 145 },
      { type: 'cow_share', label: 'Cow Share', price: 120 },
      { type: 'cow_full', label: 'Full Cow', price: 840 },
    ],
    description: 'Support conflict-affected communities',
    urgency: true
  },
  {
    id: 'kashmir-pakistan',
    name: 'Kashmir Pakistan',
    flag: '\u{1F1F5}\u{1F1F0}',
    image: 'https://images.unsplash.com/photo-1566296314636-5c71a3b24df9?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'goat', label: 'Goat', price: 125 },
      { type: 'sheep', label: 'Sheep', price: 125 },
      { type: 'cow_share', label: 'Cow Share', price: 100 },
      { type: 'cow_full', label: 'Full Cow', price: 700 },
    ],
    description: 'Reach families in Kashmir region',
    urgency: true
  },
  {
    id: 'kashmir-india',
    name: 'Kashmir India',
    flag: '\u{1F1EE}\u{1F1F3}',
    image: 'https://images.unsplash.com/photo-1566837497312-7be7830ae9b3?w=400&q=80',
    category: ['most-needed', 'emergency', 'lowest-price'],
    animals: [
      { type: 'goat', label: 'Goat', price: 75 },
      { type: 'sheep', label: 'Sheep', price: 75 },
      { type: 'cow_share', label: 'Cow Share', price: 50 },
      { type: 'cow_full', label: 'Full Cow', price: 350 },
    ],
    description: 'Support families in Indian Kashmir',
    urgency: true,
    lowestPrice: true
  },
  {
    id: 'myanmar-refugees',
    name: 'Myanmar Refugees',
    flag: '\u{1F1F2}\u{1F1F2}',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'goat', label: 'Goat', price: 125 },
      { type: 'cow_share', label: 'Cow Share', price: 100 },
      { type: 'cow_full', label: 'Full Cow', price: 700 },
    ],
    description: 'Rohingya refugee communities',
    urgency: true
  },
  {
    id: 'refugees-jordan',
    name: 'Refugees in Jordan',
    flag: '\u{1F1EF}\u{1F1F4}',
    image: 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 275 },
      { type: 'cow_share', label: 'Cow Share', price: 250 },
      { type: 'cow_full', label: 'Full Cow', price: 1750 },
    ],
    description: 'Syrian refugees in Jordan camps',
    urgency: true
  },
  {
    id: 'refugees-lebanon',
    name: 'Refugees in Lebanon',
    flag: '\u{1F1F1}\u{1F1E7}',
    image: 'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?w=400&q=80',
    category: ['most-needed', 'emergency'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 225 },
      { type: 'cow_share', label: 'Cow Share', price: 200 },
      { type: 'cow_full', label: 'Full Cow', price: 1400 },
    ],
    description: 'Refugee families in Lebanon',
    urgency: true
  },
  {
    id: 'bosnia',
    name: 'Bosnia',
    flag: '\u{1F1E7}\u{1F1E6}',
    image: 'https://images.unsplash.com/photo-1555990538-1e6b2e07e0c0?w=400&q=80',
    category: ['most-needed'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 300 },
      { type: 'cow_share', label: 'Cow Share', price: 250 },
      { type: 'cow_full', label: 'Full Cow', price: 1750 },
    ],
    description: 'Support Bosnian Muslim communities'
  },
  // LOWEST PRICE Countries
  {
    id: 'india',
    name: 'India',
    flag: '\u{1F1EE}\u{1F1F3}',
    image: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=400&q=80',
    category: ['lowest-price'],
    animals: [
      { type: 'goat', label: 'Goat', price: 75 },
      { type: 'sheep', label: 'Sheep', price: 75 },
      { type: 'cow_share', label: 'Cow Share', price: 50 },
      { type: 'cow_full', label: 'Full Cow', price: 350 },
    ],
    description: 'Serve underprivileged communities',
    lowestPrice: true
  },
  {
    id: 'burundi',
    name: 'Burundi',
    flag: '\u{1F1E7}\u{1F1EE}',
    image: 'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=400&q=80',
    category: ['lowest-price'],
    animals: [
      { type: 'goat', label: 'Goat', price: 100 },
      { type: 'cow_share', label: 'Cow Share', price: 75 },
      { type: 'cow_full', label: 'Full Cow', price: 525 },
    ],
    description: 'Feed families in East Africa',
    lowestPrice: true
  },
  {
    id: 'kenya',
    name: 'Kenya',
    flag: '\u{1F1F0}\u{1F1EA}',
    image: 'https://images.unsplash.com/photo-1489392191049-fc10c97e64b6?w=400&q=80',
    category: ['lowest-price'],
    animals: [
      { type: 'goat', label: 'Goat', price: 85 },
      { type: 'sheep', label: 'Sheep', price: 85 },
      { type: 'cow_share', label: 'Cow Share', price: 80 },
      { type: 'cow_full', label: 'Full Cow', price: 560 },
    ],
    description: 'East African communities',
    lowestPrice: true
  },
  {
    id: 'bangladesh',
    name: 'Bangladesh',
    flag: '\u{1F1E7}\u{1F1E9}',
    image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&q=80',
    category: ['lowest-price'],
    animals: [
      { type: 'goat', label: 'Goat', price: 125 },
      { type: 'sheep', label: 'Sheep', price: 125 },
      { type: 'cow_share', label: 'Cow Share', price: 100 },
      { type: 'cow_full', label: 'Full Cow', price: 700 },
    ],
    description: 'Feed families in rural areas',
    lowestPrice: true
  },
  {
    id: 'rohingya-malaysia',
    name: 'Rohingya Malaysia',
    flag: '\u{1F1F2}\u{1F1FE}',
    image: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=400&q=80',
    category: ['lowest-price', 'emergency'],
    animals: [
      { type: 'goat', label: 'Goat', price: 110 },
      { type: 'cow_share', label: 'Cow Share', price: 85 },
      { type: 'cow_full', label: 'Full Cow', price: 595 },
    ],
    description: 'Rohingya refugees in Malaysia',
    lowestPrice: true,
    urgency: true
  },
  // ALL OTHER Countries
  {
    id: 'pakistan',
    name: 'Pakistan',
    flag: '\u{1F1F5}\u{1F1F0}',
    image: 'https://images.unsplash.com/photo-1586076052079-81a12e3c24c9?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 140 },
      { type: 'sheep', label: 'Sheep', price: 140 },
      { type: 'cow_share', label: 'Cow Share', price: 115 },
      { type: 'cow_full', label: 'Full Cow', price: 805 },
    ],
    description: 'Reach communities across Pakistan'
  },
  {
    id: 'somalia',
    name: 'Somalia',
    flag: '\u{1F1F8}\u{1F1F4}',
    image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400&q=80',
    category: ['all', 'emergency'],
    animals: [
      { type: 'goat', label: 'Goat', price: 150 },
      { type: 'sheep', label: 'Sheep', price: 150 },
      { type: 'cow_share', label: 'Cow Share', price: 125 },
      { type: 'cow_full', label: 'Full Cow', price: 875 },
    ],
    description: 'Aid for drought-affected areas',
    urgency: true
  },
  {
    id: 'jordan',
    name: 'Jordan',
    flag: '\u{1F1EF}\u{1F1F4}',
    image: 'https://images.unsplash.com/photo-1580834341580-8c17a3a630ca?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 300 },
      { type: 'cow_share', label: 'Cow Share', price: 275 },
      { type: 'cow_full', label: 'Full Cow', price: 1925 },
    ],
    description: 'Local Jordanian communities'
  },
  {
    id: 'lebanon',
    name: 'Lebanon',
    flag: '\u{1F1F1}\u{1F1E7}',
    image: 'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 250 },
      { type: 'cow_share', label: 'Cow Share', price: 225 },
      { type: 'cow_full', label: 'Full Cow', price: 1575 },
    ],
    description: 'Lebanese families in need'
  },
  {
    id: 'turkey',
    name: 'Turkey',
    flag: '\u{1F1F9}\u{1F1F7}',
    image: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 275 },
      { type: 'cow_share', label: 'Cow Share', price: 250 },
      { type: 'cow_full', label: 'Full Cow', price: 1750 },
    ],
    description: 'Syrian refugee support in Turkey'
  },
  {
    id: 'indonesia',
    name: 'Indonesia',
    flag: '\u{1F1EE}\u{1F1E9}',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 225 },
      { type: 'cow_share', label: 'Cow Share', price: 200 },
      { type: 'cow_full', label: 'Full Cow', price: 1400 },
    ],
    description: 'Island communities across Indonesia'
  },
  {
    id: 'mali',
    name: 'Mali',
    flag: '\u{1F1F2}\u{1F1F1}',
    image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 125 },
      { type: 'sheep', label: 'Sheep', price: 125 },
      { type: 'cow_share', label: 'Cow Share', price: 100 },
      { type: 'cow_full', label: 'Full Cow', price: 700 },
    ],
    description: 'Sahel region support'
  },
  {
    id: 'niger',
    name: 'Niger',
    flag: '\u{1F1F3}\u{1F1EA}',
    image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 125 },
      { type: 'sheep', label: 'Sheep', price: 125 },
      { type: 'cow_share', label: 'Cow Share', price: 100 },
      { type: 'cow_full', label: 'Full Cow', price: 700 },
    ],
    description: 'Food security programs'
  },
  {
    id: 'ethiopia',
    name: 'Ethiopia',
    flag: '\u{1F1EA}\u{1F1F9}',
    image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 115 },
      { type: 'sheep', label: 'Sheep', price: 115 },
      { type: 'cow_share', label: 'Cow Share', price: 90 },
      { type: 'cow_full', label: 'Full Cow', price: 630 },
    ],
    description: 'Drought relief efforts'
  },
  {
    id: 'ghana',
    name: 'Ghana',
    flag: '\u{1F1EC}\u{1F1ED}',
    image: 'https://images.unsplash.com/photo-1577019750148-cdfc23fd812b?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 135 },
      { type: 'sheep', label: 'Sheep', price: 135 },
      { type: 'cow_share', label: 'Cow Share', price: 110 },
      { type: 'cow_full', label: 'Full Cow', price: 770 },
    ],
    description: 'West African families'
  },
  {
    id: 'senegal',
    name: 'Senegal',
    flag: '\u{1F1F8}\u{1F1F3}',
    image: 'https://images.unsplash.com/photo-1577019750148-cdfc23fd812b?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 135 },
      { type: 'sheep', label: 'Sheep', price: 135 },
      { type: 'cow_share', label: 'Cow Share', price: 110 },
      { type: 'cow_full', label: 'Full Cow', price: 770 },
    ],
    description: 'Coastal community support'
  },
  {
    id: 'mauritania',
    name: 'Mauritania',
    flag: '\u{1F1F2}\u{1F1F7}',
    image: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 100 },
      { type: 'sheep', label: 'Sheep', price: 100 },
      { type: 'camel', label: 'Camel', price: 450 },
    ],
    description: 'Desert communities'
  },
  {
    id: 'chad',
    name: 'Chad',
    flag: '\u{1F1F9}\u{1F1E9}',
    image: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 120 },
      { type: 'sheep', label: 'Sheep', price: 120 },
      { type: 'cow_share', label: 'Cow Share', price: 95 },
      { type: 'cow_full', label: 'Full Cow', price: 665 },
    ],
    description: 'Central African support'
  },
  {
    id: 'cameroon',
    name: 'Cameroon',
    flag: '\u{1F1E8}\u{1F1F2}',
    image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 125 },
      { type: 'sheep', label: 'Sheep', price: 125 },
      { type: 'cow_share', label: 'Cow Share', price: 100 },
      { type: 'cow_full', label: 'Full Cow', price: 700 },
    ],
    description: 'Cameroonian families'
  },
  {
    id: 'nigeria',
    name: 'Nigeria',
    flag: '\u{1F1F3}\u{1F1EC}',
    image: 'https://images.unsplash.com/photo-1618828665011-0abd973f7bb8?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 125 },
      { type: 'sheep', label: 'Sheep/Ram', price: 125 },
      { type: 'cow_share', label: 'Cow Share', price: 100 },
      { type: 'cow_full', label: 'Full Cow', price: 700 },
    ],
    description: 'Nigerian Muslim communities'
  },
  {
    id: 'tanzania',
    name: 'Tanzania',
    flag: '\u{1F1F9}\u{1F1FF}',
    image: 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 110 },
      { type: 'sheep', label: 'Sheep', price: 110 },
      { type: 'cow_share', label: 'Cow Share', price: 85 },
      { type: 'cow_full', label: 'Full Cow', price: 595 },
    ],
    description: 'Tanzanian communities'
  },
  {
    id: 'uganda',
    name: 'Uganda',
    flag: '\u{1F1FA}\u{1F1EC}',
    image: 'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 110 },
      { type: 'cow_share', label: 'Cow Share', price: 85 },
      { type: 'cow_full', label: 'Full Cow', price: 595 },
    ],
    description: 'Ugandan Muslim families'
  },
  {
    id: 'egypt',
    name: 'Egypt',
    flag: '\u{1F1EA}\u{1F1EC}',
    image: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 225 },
      { type: 'cow_share', label: 'Cow Share', price: 200 },
      { type: 'cow_full', label: 'Full Cow', price: 1400 },
    ],
    description: 'Egyptian families in need'
  },
  {
    id: 'morocco',
    name: 'Morocco',
    flag: '\u{1F1F2}\u{1F1E6}',
    image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 250 },
      { type: 'cow_share', label: 'Cow Share', price: 225 },
      { type: 'cow_full', label: 'Full Cow', price: 1575 },
    ],
    description: 'Moroccan communities'
  },
  {
    id: 'tunisia',
    name: 'Tunisia',
    flag: '\u{1F1F9}\u{1F1F3}',
    image: 'https://images.unsplash.com/photo-1534551767192-78b8dd45b51b?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 225 },
      { type: 'cow_share', label: 'Cow Share', price: 200 },
      { type: 'cow_full', label: 'Full Cow', price: 1400 },
    ],
    description: 'Tunisian families'
  },
  {
    id: 'albania',
    name: 'Albania',
    flag: '\u{1F1E6}\u{1F1F1}',
    image: 'https://images.unsplash.com/photo-1565257726420-01a9573cc128?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 275 },
      { type: 'cow_share', label: 'Cow Share', price: 250 },
      { type: 'cow_full', label: 'Full Cow', price: 1750 },
    ],
    description: 'Albanian Muslim communities'
  },
  {
    id: 'kosovo',
    name: 'Kosovo',
    flag: '\u{1F1FD}\u{1F1F0}',
    image: 'https://images.unsplash.com/photo-1558271736-cd043ef0e013?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'sheep', label: 'Sheep', price: 300 },
      { type: 'cow_share', label: 'Cow Share', price: 275 },
      { type: 'cow_full', label: 'Full Cow', price: 1925 },
    ],
    description: 'Kosovar families'
  },
  {
    id: 'philippines',
    name: 'Philippines',
    flag: '\u{1F1F5}\u{1F1ED}',
    image: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 175 },
      { type: 'cow_share', label: 'Cow Share', price: 150 },
      { type: 'cow_full', label: 'Full Cow', price: 1050 },
    ],
    description: 'Mindanao Muslim communities'
  },
  {
    id: 'sri-lanka',
    name: 'Sri Lanka',
    flag: '\u{1F1F1}\u{1F1F0}',
    image: 'https://images.unsplash.com/photo-1586185331496-11cadf8c31fb?w=400&q=80',
    category: ['all'],
    animals: [
      { type: 'goat', label: 'Goat', price: 125 },
      { type: 'cow_share', label: 'Cow Share', price: 100 },
      { type: 'cow_full', label: 'Full Cow', price: 700 },
    ],
    description: 'Sri Lankan Muslim families'
  },
  {
    id: 'nepal',
    name: 'Nepal',
    flag: '\u{1F1F3}\u{1F1F5}',
    image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&q=80',
    category: ['all', 'lowest-price'],
    animals: [
      { type: 'goat', label: 'Goat', price: 100 },
      { type: 'cow_share', label: 'Cow Share', price: 75 },
      { type: 'cow_full', label: 'Full Cow', price: 525 },
    ],
    description: 'Mountain community support',
    lowestPrice: true
  },
];

async function main() {
  console.log(`Seeding ${countries.length} qurbani countries into template_config...`);

  // First, get the current template_config for the qurbani campaign
  const { data: campaign, error: fetchError } = await client
    .from('campaigns')
    .select('id, slug, template_config')
    .eq('slug', 'qurbani')
    .single();

  if (fetchError) {
    console.error('Error fetching qurbani campaign:', fetchError);
    process.exit(1);
  }

  if (!campaign) {
    console.error('No qurbani campaign found with slug "qurbani"');
    process.exit(1);
  }

  console.log(`Found campaign: ${campaign.id} (slug: ${campaign.slug})`);
  console.log(`Existing template_config keys: ${Object.keys(campaign.template_config || {}).join(', ') || '(none)'}`);

  // Merge countries into existing template_config
  const updatedConfig = {
    ...(campaign.template_config || {}),
    countries
  };

  const { error: updateError } = await client
    .from('campaigns')
    .update({ template_config: updatedConfig })
    .eq('id', campaign.id);

  if (updateError) {
    console.error('Error updating template_config:', updateError);
    process.exit(1);
  }

  console.log(`Successfully saved ${countries.length} countries to template_config.countries`);
  console.log('Countries:', countries.map(c => c.name).join(', '));
}

main().catch(console.error);

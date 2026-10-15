/**
 * Default CMS content mirrored from admin-auth.js getDefault* helpers.
 * Used by seeds only — keep in sync when site defaults change.
 */

const infrastructure = {
  hero: {
    brand: 'Sekar Constructions',
    title: 'Infrastructure & Assets',
    lead: 'Owned quarries, crushing plants, batching machinery, and a full fleet - engineered for quality, schedule certainty, and self-reliant execution.',
    ctaLabel: 'Explore Inventory',
    ctaHref: '#infra-inventory',
    image: 'bhel-btg-civil.jpg',
  },
  highlights: [
    { key: 'quarries', label: 'Quarries', value: '4', note: 'Blue metal quarries under direct ownership' },
    { key: 'crushing', label: 'Crushing Plants', value: '3', note: 'Dedicated crushing capacity for project supply' },
    { key: 'assets', label: 'Asset Lines', value: '44', note: 'Owned equipment inventory line items' },
  ],
  inventory: [
    { id: 'infra-1', category: 'machinery', description: 'Concrete Boom Pump - 40.10ZX, S36X', qty: '3', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-2', category: 'machinery', description: 'Batching Plant - M1T, M1C, KYB 450 & CP45, Z30 & CP30', qty: '6', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-3', category: 'machinery', description: 'RMC Transit Mixer', qty: '14', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-4', category: 'machinery', description: 'Concrete Pump 1800', qty: '4', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-5', category: 'heavy', description: 'Mobile Tower Crane [ACE Make]', qty: '3', unit: 'Nos', categoryLabel: 'Lifting & Excavation' },
    { id: 'infra-6', category: 'heavy', description: 'Excavator - Hitachi EX 210', qty: '2', unit: 'Nos', categoryLabel: 'Lifting & Excavation' },
    { id: 'infra-7', category: 'heavy', description: 'JCB', qty: '8', unit: 'Nos', categoryLabel: 'Lifting & Excavation' },
    { id: 'infra-8', category: 'heavy', description: 'Vibromax 10T - Roller', qty: '1', unit: 'Nos', categoryLabel: 'Lifting & Excavation' },
    { id: 'infra-9', category: 'heavy', description: 'Walking Roller 1MT', qty: '3', unit: 'Nos', categoryLabel: 'Lifting & Excavation' },
    { id: 'infra-10', category: 'heavy', description: 'BOBCAT S450', qty: '5', unit: 'Nos', categoryLabel: 'Lifting & Excavation' },
    { id: 'infra-11', category: 'vehicles', description: 'Tipper 10 Wheel', qty: '4', unit: 'Nos', categoryLabel: 'Vehicles & Transport' },
    { id: 'infra-12', category: 'vehicles', description: 'Tractor', qty: '4', unit: 'Nos', categoryLabel: 'Vehicles & Transport' },
    { id: 'infra-13', category: 'vehicles', description: 'TATA Diesel Tanker', qty: '1', unit: 'Nos', categoryLabel: 'Vehicles & Transport' },
    { id: 'infra-14', category: 'vehicles', description: 'Mahindra & Eicher Van', qty: '8', unit: 'Nos', categoryLabel: 'Vehicles & Transport' },
    { id: 'infra-15', category: 'heavy', description: 'Building Hoist', qty: '5', unit: 'Sets.', categoryLabel: 'Lifting & Excavation' },
    { id: 'infra-16', category: 'scaffolding', description: 'MS Cuplock System', qty: '400', unit: 'MT', categoryLabel: 'Scaffolding & Formwork' },
    { id: 'infra-17', category: 'scaffolding', description: 'System Form Work', qty: '4,120', unit: 'Sqm', categoryLabel: 'Scaffolding & Formwork' },
    { id: 'infra-18', category: 'scaffolding', description: 'MS Jolly (Platform)', qty: '6,500', unit: 'Nos', categoryLabel: 'Scaffolding & Formwork' },
    { id: 'infra-19', category: 'scaffolding', description: 'MS Scaffolding Pipes', qty: '30,000', unit: 'Nos', categoryLabel: 'Scaffolding & Formwork' },
    { id: 'infra-20', category: 'scaffolding', description: 'Props 2+2m, 2+3m, 3+3m', qty: '3,500', unit: 'Sets.', categoryLabel: 'Scaffolding & Formwork' },
    { id: 'infra-21', category: 'scaffolding', description: 'Agrow Spans 2.4m & 3.0m', qty: '1,500', unit: 'Sets.', categoryLabel: 'Scaffolding & Formwork' },
    { id: 'infra-22', category: 'scaffolding', description: 'Centering Sheets 3\' x 2\', 4\' x 2\'', qty: '1,500', unit: 'Nos', categoryLabel: 'Scaffolding & Formwork' },
    { id: 'infra-23', category: 'scaffolding', description: 'MS Velor 1.50m & 1.20m', qty: '1,300', unit: 'Nos', categoryLabel: 'Scaffolding & Formwork' },
    { id: 'infra-24', category: 'machinery', description: 'Bar Shearing Machine', qty: '15', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-25', category: 'machinery', description: 'Bar Bending Machine', qty: '15', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-26', category: 'machinery', description: 'Bar Rings Machine', qty: '2', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-27', category: 'machinery', description: 'Bar Threading Machine', qty: '1', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-28', category: 'machinery', description: 'Concrete Vibrators', qty: '28', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-29', category: 'machinery', description: 'Watering & De-Watering Pumps 5HP, 3HP', qty: '21', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-30', category: 'instruments', description: 'Total Station', qty: '7', unit: 'Nos', categoryLabel: 'Site Instruments' },
    { id: 'infra-31', category: 'instruments', description: 'Levelling Instrument', qty: '18', unit: 'Nos', categoryLabel: 'Site Instruments' },
    { id: 'infra-32', category: 'instruments', description: 'Cube Testing Machine', qty: '10', unit: 'Nos', categoryLabel: 'Site Instruments' },
    { id: 'infra-33', category: 'heavy', description: 'Soil Compacting Machine', qty: '7', unit: 'Nos', categoryLabel: 'Lifting & Excavation' },
    { id: 'infra-34', category: 'machinery', description: 'Wood Plaining Machine', qty: '3', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-35', category: 'machinery', description: 'Wood Circular Saw Machine', qty: '25', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-36', category: 'machinery', description: 'Welding Machine 3PH & 1PH', qty: '15', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-37', category: 'machinery', description: 'Hydraulic Block Making Machine', qty: '2', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-38', category: 'machinery', description: 'Fly Ash brick manufacturing Machine', qty: '1', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-39', category: 'machinery', description: 'Paver/Cover block Vibration Machine', qty: '1', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-40', category: 'quarry', description: 'Stone Crushing Machine', qty: '1', unit: 'Nos', categoryLabel: 'Quarry & Crushing' },
    { id: 'infra-41', category: 'machinery', description: 'Mixer Machine - Diesel & Electrical', qty: '3', unit: 'Nos', categoryLabel: 'Concrete Machinery' },
    { id: 'infra-42', category: 'quarry', description: 'Crusher Plant', qty: '3', unit: 'Nos', categoryLabel: 'Quarry & Crushing' },
    { id: 'infra-43', category: 'quarry', description: 'Blue Metal Quarry', qty: '4', unit: 'Nos', categoryLabel: 'Quarry & Crushing' },
    { id: 'infra-44', category: 'quarry', description: 'Weight Bridge 100MT', qty: '1', unit: 'Nos', categoryLabel: 'Quarry & Crushing' },
  ],
};

const ongoing = {
  hero: {
    brand: 'Sekar Constructions',
    title: 'Ongoing Projects',
    lead: 'High-value industrial, utility, and heavy structural contracts across Tamil Nadu and Andhra Pradesh — tracked live by progress, scope, and location.',
    ctaLabel: 'View Active Sites',
    ctaHref: '#ongoing-projects',
    image: 'kochar-warehouse.jpg',
  },
  highlights: [
    { key: 'active', label: 'Active Projects', value: '9', note: 'Live contracts currently under execution' },
    { key: 'tn', label: 'Tamil Nadu', value: '7', note: 'Active sites across Chennai and Kalpakkam' },
    { key: 'ap', label: 'Andhra Pradesh', value: '2', note: 'BARC campus works near Visakhapatnam' },
  ],
  projects: [
    { id: 'ongoing-tn-1', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '1', name: 'Construction of Warehouse 8 Civil works, Ancillary Building and external works in Kochar Industrial Park at Kandamangalam, Tiruvallur Dist - 602105', patron: 'M/S. Kochar Properties Pvt Ltd. Chennai', valueLakhs: '2,926', progress: '25' },
    { id: 'ongoing-tn-3', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '3', name: 'Civil, Structural & Architectural works for foundation & superstructure of various buildings & other miscellaneous structures of Unit # 2 of BTG area at 2x660MW Ennore SEZ STPP (on the ash dyke of NCTPS)', patron: 'BHEL (TNEB) Chennai', valueLakhs: '9,313', progress: '76' },
    { id: 'ongoing-tn-4', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '4', name: 'Construction of 400 MLD SWRO Desalination Plant for CMWSSB at Perur, Chennai.', patron: 'CMWSSB, Chennai', valueLakhs: '6,688', progress: '65' },
    { id: 'ongoing-tn-5', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '5', name: 'Construction of Power Station 2 at FRFCF, DAE, Kalpakkam site', patron: 'FRFCF, DAE, Kalpakkam', valueLakhs: '938', progress: '80' },
    { id: 'ongoing-tn-6', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '6', name: 'Construction of Air Supply, Storage & Exhaust Building for SWPB of CWMF, BARCF at Kalpakkam', patron: 'CWMF, BARCF, Kalpakkam', valueLakhs: '691', progress: '58' },
    { id: 'ongoing-tn-7', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '7', name: 'Construction of Commercial Building B+G+3 at Thoraipakkam', patron: 'M/S. Jain Group Chennai', valueLakhs: '1,505', progress: '28' },
    { id: 'ongoing-tn-8', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '8', name: 'Construction of Hostel Building G+4 for NMV University', patron: 'M/S. Savitha Group of Colleges', valueLakhs: '2,666', progress: '8' },
    { id: 'ongoing-ap-1', region: 'ap', regionLabel: 'Andhra Pradesh', slNo: '1', name: 'Construction of E & F superstructure works of TL-3, finishing works and other miscellaneous works of TL 123 at BARC main campus, Near Visakhapatnam, AP', patron: 'BARC, Vizag', valueLakhs: '1,755', progress: '84' },
    { id: 'ongoing-ap-2', region: 'ap', regionLabel: 'Andhra Pradesh', slNo: '2', name: 'Supply laying installation testing of underground Chilled water pipeline works from UC-1 CAP towards eastern & western side of campus to cover nearby facilities including provision for future expansion at BARC (V), Atchutapuram near Visakhapatnam', patron: 'BARC, Vizag', valueLakhs: '1,380', progress: '25' },
  ],
};

const completed = {
  hero: {
    brand: 'Sekar Constructions',
    title: 'Completed Projects',
    lead: 'Since 1995, Sekar Constructions has built an impeccable reputation for executing critical civil engineering structures across India.',
    ctaLabel: 'View Completed Works',
    ctaHref: '#completed-projects',
    image: 'kochar-warehouse.jpg',
  },
  highlights: [
    { key: 'completed', label: 'Completed Works', value: '12', note: 'Audited major works directory' },
    { key: 'value', label: 'Combined Value', value: '502', note: '₹ Crores across completed major contracts' },
    { key: 'years', label: 'Since', value: '1995', note: 'Class-I civil engineering track record' },
  ],
  projects: [
    { id: 'completed-tn-1', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '1', name: 'Site Development and Compound wall works & Construction of Warehouse (7nos) Civil works, Ancillary Building, external works and Plumbing in Kochar Industrial Park at Kandamangalam, Tiruvallur Dist - 602105', valueLakhs: '10006.62' },
    { id: 'completed-tn-2', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '2', name: 'Construction of On-Site Emergency support centre at Kalpakkam site', valueLakhs: '6080.00' },
    { id: 'completed-tn-3', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '3', name: 'Construction of C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri (Civil, PH, storm water drains work and mechanical doors)', valueLakhs: '5630.00' },
    { id: 'completed-tn-4', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '4', name: 'Construction of 150 MLD SWRO Desalination Plant for CMWSSB, Nemmeli on behalf of Cobratecton Pvt. Ltd., Chennai.', valueLakhs: '5232.66' },
    { id: 'completed-tn-5', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '5', name: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam', valueLakhs: '3654.76' },
    { id: 'completed-tn-6', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '6', name: 'Construction of Proposed Factory Building, Warehouse Buildings and Ancillary Building Works including Plumbing at Irungattukottai, Chennai', valueLakhs: '7150.72' },
    { id: 'completed-tn-7', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '7', name: 'Construction of Student Hostel block, Academic block, Ware House, Canteen, Substation, Library, Plumbing work, Sewage Treatment Plant and other miscellaneous work under Phase – III at Great Lakes Institute of Management, Manamai at Kalpakkam.', valueLakhs: '3146.00' },
    { id: 'completed-tn-8', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '8', name: 'Construction of 116 Nos. of type II-B Residential Quarters in DAE Township at Kalpakkam [including electrical work]', valueLakhs: '2583.04' },
    { id: 'completed-tn-9', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '9', name: 'Construction of 233 Nos of New academic block including Civil, Mechanical, Electrical, Public health and other miscellaneous works under Phase - IV at Great Lakes Institute of Management, ECR, Manamai.', valueLakhs: '2357.00' },
    { id: 'completed-tn-10', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '10', name: 'Construction of AUSE Lab Building at IGCAR, Kalpakkam', valueLakhs: '1645.08' },
    { id: 'completed-tn-11', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '11', name: 'Construction of Balance works for 120 nos. of type IIIC quarters (Tower 4 -G+15 story) in DAE Township at Anupuram.', valueLakhs: '1384.33' },
    { id: 'completed-tn-12', region: 'tn', regionLabel: 'Tamil Nadu', slNo: '12', name: 'Construction of Infrastructure facilities for Store and workshop for FRFCF at IGCAR, Kalpakkam on behalf of Consolidated Construction Consortium Ltd, Chennai.', valueLakhs: '1360.00' },
  ],
};

const gallery = {
  hero: {
    brand: 'Sekar Constructions',
    title: 'Project Gallery',
    lead: 'A visual tour of landmark civil works — power, desalination, industrial parks, and institutional campuses across Tamil Nadu.',
    ctaLabel: 'Browse Case Studies',
    ctaHref: '#project-gallery',
    image: 'desalination-plant.jpg',
  },
  highlights: [
    { key: 'studies', label: 'Case Studies', value: '12', note: 'Featured visual project stories' },
    { key: 'sectors', label: 'Sectors', value: '3', note: 'Infrastructure, industrial & commercial' },
    { key: 'years', label: 'Since', value: '1995', note: 'Documented Class-I delivery track record' },
  ],
  items: [
    { id: 'gallery-bhel-ennore', category: 'industrial', categoryLabel: 'Power Station & Energy', title: 'BHEL Ennore SEZ STPP', fullTitle: 'BHEL, 2 x 660 MW Ennore SEZ STPP', client: 'BHEL / TANGEDCO', value: '₹88.40 Crore', valueBadge: '₹88.40 Cr', location: 'Ennore, Chennai, TN', scope: 'Thermal power plant turbine foundations, boiler structures, substations', image: 'bhel-power-plant.jpg', images: ['bhel-power-plant.jpg'], shortDesc: 'Civil foundations and boiler structural framing works for the 2 x 660 MW Thermal Power Plant at Ennore.', description: 'Heavy civil infrastructure works for the 2 x 660 MW supercritical Ennore SEZ Thermal Power Project. Scope included constructing heavy concrete turbine generator foundations, boiler support structures, sub-station structures, auxiliary plant buildings, and surrounding utility trenches.' },
    { id: 'gallery-bhel-btg', category: 'industrial', categoryLabel: 'Power Station & Energy', title: 'BHEL BTG Area Civil Works', fullTitle: 'BTG Area Civil Works, BHEL Thermal Power Plant', client: 'TNEB / BHEL', value: '₹93.13 Crore', valueBadge: '₹93.13 Cr', location: 'Voyalur PO, Minjur, Ponneri, Tiruvallur Dist., TN', scope: 'Civil, Structural & Architectural works for Unit #2 BTG area', image: 'bhel-btg-civil.jpg', images: ['bhel-btg-civil.jpg'], shortDesc: 'Civil, structural, and architectural superstructure works for Unit #2 BTG area at Ennore SEZ STPP.', description: 'Execution of civil, structural, and architectural works for the foundation and superstructure of various buildings and miscellaneous structures within Unit #2 of the Boiler-Turbine-Generator (BTG) area at the 2x660MW Ennore SEZ Supercritical Thermal Power Project.' },
    { id: 'gallery-desal-400', category: 'infrastructure', categoryLabel: 'Water Utilities', title: '400 MLD Desalination Plant', fullTitle: 'Construction of 400 MLD Desalination Plant for CMWSSB', client: 'Cobratecton / CMWSSB', value: '₹120.40 Crore', valueBadge: '₹120.40 Cr', location: 'East Coast Road, Chennai, TN', scope: 'Desalination plant basins, pump houses, SWRO intake foundations', image: 'desal-400-site-aerial.png', images: ['desal-400-site-aerial.png', 'desal-400-excavation.png', 'desal-400-foundation.png', 'desal-400-concrete-pour.png', 'desal-400-circular-tank.png', 'desal-400-clarifiers.png', 'desal-400-reservoir.png', 'desal-400-coastal-basins.png'], shortDesc: 'Marine-grade concrete process basins, intake structures, and pump house civil works for CMWSSB along ECR.', description: 'Executed marine-grade concrete containment basins and processing structures for the 400 MLD Seawater Reverse Osmosis (SWRO) desalination facility for CMWSSB. Used highly resilient anti-corrosive concrete mixes to withstand high-salinity environment and coastal elements.' },
    { id: 'gallery-desal-150', category: 'infrastructure', categoryLabel: 'Water Utilities', title: '150 MLD Nemmeli SWRO Plant', fullTitle: 'Construction of Civil work at 150 MLD SWRO Desalination plant at ECR, Nemmeli, Chennai on behalf of Cobratecton Private Limited.', client: 'Cobratecton Pvt. Ltd. Chennai', value: '₹52.32 Crore', valueBadge: '₹52.32 Cr', location: 'ECR, Nemmeli, Chennai, TN', scope: 'SWRO plant civil works, process basins, foundations', image: 'nemmeli-desal-coastal-aerial.png', images: ['nemmeli-desal-coastal-aerial.png', 'nemmeli-desal-tanks.png', 'nemmeli-desalination.jpg', 'nemmeli-desal-aerial.png', 'nemmeli-desal-basins.png', 'nemmeli-desal-civil-works.png'], shortDesc: 'Civil works for the 150 MLD SWRO desalination plant at ECR, Nemmeli on behalf of Cobratecton Private Limited.', description: 'Execution of civil engineering works for the 150 MLD Seawater Reverse Osmosis (SWRO) desalination plant at ECR, Nemmeli, Chennai on behalf of Cobratecton Private Limited. The project involved constructing robust structural concrete systems, massive water storage basins, and foundations for processing machinery under strict marine environmental specifications.' },
    { id: 'gallery-desal-perur', category: 'infrastructure', categoryLabel: 'Water Utilities', title: 'Perur 400 MLD SWRO Plant', fullTitle: 'Perur 400 MLD Desalination Project', client: 'VA TECH WABAG Ltd. / CMWSSB', value: '₹66.88 Crore', valueBadge: '₹66.88 Cr', location: 'Perur, ECR, Chennai, TN', scope: 'SWRO plant civil works, massive intake sump, process plant foundations', image: 'perur-desalination.jpg', images: ['perur-desalination.jpg'], shortDesc: 'Civil and concrete structural works for the mega 400 MLD SWRO plant at Perur on behalf of VA TECH WABAG Ltd.', description: 'Civil, structural, and architectural construction works for the mega 400 MLD Seawater Reverse Osmosis (SWRO) desalination plant at Perur, Chennai on behalf of VA TECH WABAG Ltd. Works include deep excavation, high-durability marine concrete foundations, water collection reservoirs, and structural framing for main processing halls.' },
    { id: 'gallery-kochar', category: 'industrial', categoryLabel: 'Logistics Park', title: 'Kochar Industrial Park', fullTitle: 'Kochar Industrial & Logistics Park', client: 'Kochar Group', value: '₹40.46 Crore', valueBadge: '₹40.46 Cr', location: 'Tiruvallur, Chennai, TN', scope: 'Industrial warehouses, concrete perimeter walling, external roads', image: 'kochar-warehouse.jpg', images: ['kochar-warehouse.jpg', 'kochar-entrance.png', 'kochar-aerial.png', 'kochar-warehouse-01.png', 'kochar-warehouse-07.png'], shortDesc: 'Site development, concrete compound walls, construction of Warehouse 1, and external road works.', description: 'Site development and warehouse block construction inside the Kochar Industrial Park at Tiruvallur. The contract included massive grading, sub-station foundations, heavy compound walls, external drainage, and high-load internal asphalt roads.' },
    { id: 'gallery-polyhose', category: 'industrial', categoryLabel: 'Industrial Facility', title: 'Polyhose Factory & PEB Warehouse', fullTitle: 'Construction of Factory Buildings, Warehouses And Ancillary Buildings for Polyhose India, Irungattukottai', client: 'Polyhose India Pvt. Ltd.', value: '₹71.51 Crore', valueBadge: '₹71.51 Cr', location: 'Irungattukottai, Chennai, TN', scope: 'Factory buildings, warehouses, PEB structure, ancillary buildings, plumbing', image: 'polyhose-facility.png', images: ['polyhose-facility.png', 'polyhose-foundation.png', 'polyhose-facility-front.png', 'polyhose-aerial-solar.png', 'polyhose-warehouses-aerial.png'], shortDesc: 'Factory buildings, warehouses, PEB works, and ancillary buildings for Polyhose India at Irungattukottai.', description: 'Construction of proposed factory buildings, warehouse buildings including PEB works, and ancillary building works including plumbing for Polyhose India at Irungattukottai, Chennai. Scope covers structural framing, machinery foundations, PEB steel framing and cladding, interior flooring, utility integration, and external service pathways across the industrial campus.' },
    { id: 'gallery-isro-c25', category: 'industrial', categoryLabel: 'Aerospace / Institutional', title: 'ISRO C25 Integration Complex', fullTitle: 'Construction of C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri', client: 'Indian Space Research Organisation (ISRO)', value: '₹56.30 Crore', valueBadge: '₹56.30 Cr', location: 'IPRC, Mahendragiri, TN', scope: 'C25 Stage Integration Complex, 1,00,000 CUM clean room, civil, PH, storm water drains, mechanical doors, area development', image: 'isro-c25-integration-exterior.png', images: ['isro-c25-integration-exterior.png', 'images/isro-chairman-felicitating-sekar-shawl.jpg', 'images/isro-chairman-felicitating-sekar-bouquet.jpg', 'isro-c25-facade.png', 'isro-clean-room-interior.png'], shortDesc: 'C25 Stage Integration Complex with 1,00,000 CUM clean room and area development works at IPRC, Mahendragiri. Inhauguration felicitated by ISRO Chairman Dr. S. Somanath.', description: 'Construction of the C25 Stage Integration Complex and area development works around the facility at IPRC, Mahendragiri for the ISRO Propulsion Complex. Scope included civil works, public health, storm water drains, mechanical doors, and a 1,00,000 CUM capacity clean room for stage integration. Founder Mr. Ethiraj Sekar was personally felicitated by ISRO Chairman Dr. S. Somanath during the official inauguration and award function.' },
    { id: 'gallery-igcar-hall-v', category: 'industrial', categoryLabel: 'Nuclear / Institutional', title: 'IGCAR Engineering Hall V', fullTitle: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam', client: 'Indira Gandhi Centre for Atomic Research (IGCAR)', value: '₹36.55 Crore', valueBadge: '₹36.55 Cr', location: 'IGCAR, Kalpakkam, TN', scope: 'Engineering Hall – V civil construction', image: 'igcar-engineering-hall-v.png', images: ['igcar-engineering-hall-v.png'], shortDesc: 'Engineering Hall – V civil construction for IGCAR at Kalpakkam.', description: 'Construction of Engineering Hall – V in IGCAR at Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).' },
    { id: 'gallery-igcar-water-tank', category: 'infrastructure', categoryLabel: 'Water Utilities', title: 'IGCAR Water Tank', fullTitle: 'Construction of Water Tanker 4.5Lakhs Capacity 18m Height at IGCAR, Kalpakkam', client: 'Indira Gandhi Centre for Atomic Research (IGCAR)', value: '', valueBadge: '', location: 'IGCAR, Kalpakkam, TN', scope: 'Elevated water tank, 4.5 lakh litre capacity, 18 m height', image: 'igcar-water-tank.png', images: ['igcar-water-tank.png'], shortDesc: '4.5 lakh litre capacity elevated water tank (18 m height) under construction at IGCAR, Kalpakkam.', description: 'Construction of an elevated water tank of 4.5 lakh litre capacity and 18 m height at IGCAR, Kalpakkam for the Indira Gandhi Centre for Atomic Research (Department of Atomic Energy).' },
    { id: 'gallery-great-lakes', category: 'commercial', categoryLabel: 'Commercial & Institutional', title: 'Great Lakes Campus', fullTitle: 'Construction of Class Rooms, Residential Quarters and Compound wall at Great Lakes Institute of Management, ECR at Manamai', client: 'Great Lakes Institute of Management', value: '₹31.46 Crore', valueBadge: '₹31.46 Cr', location: 'Manamai, ECR, Chennai, TN', scope: 'Class Rooms, Residential Quarters, Compound Wall, Academic Block, Hostels', image: 'great-lakes-campus.jpg', images: ['great-lakes-campus.jpg', 'images/great-lakes-site-blueprint-review.jpg', 'great-lakes-entrance.png', 'great-lakes-building.png', 'great-lakes-hostel-court.png'], shortDesc: 'Construction of Class Rooms, Residential Quarters and Compound wall at Great Lakes Institute of Management, ECR at Manamai.', description: 'Construction of Class Rooms, Residential Quarters and Compound wall at Great Lakes Institute of Management, ECR at Manamai. The project included structural and finishing works for academic blocks, student & faculty residential quarters, sub-station, perimeter compound walling, sewage treatment plant, and comprehensive site infrastructure development.' },
    { id: 'gallery-dae-quarters', category: 'commercial', categoryLabel: 'Residential Township', title: 'DAE Type II-B Quarters', fullTitle: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam [including electrical work]', client: 'Department of Atomic Energy (DAE)', value: '₹25.83 Crore', valueBadge: '₹25.83 Cr', location: 'DAE Township, Kalpakkam, TN', scope: '116 Nos. Type II-B residential quarters including electrical work', image: 'dae-kalpakkam-type-iib-quarters.png', images: ['dae-kalpakkam-type-iib-quarters.png'], shortDesc: '116 Type II-B residential quarters with electrical works in DAE Township at Kalpakkam.', description: 'Construction of 116 Nos. of type II-B Residential quarters in DAE Township at Kalpakkam, including electrical work. The project delivered multi-storey township housing blocks with associated electrical installations for Department of Atomic Energy residential accommodation.' },
  ],
};

const fleet = [
  { key: 'rmc', name: 'RMC Batching Plants', count: '5', icon: 'fa-industry', logoUrl: '' },
  { key: 'mixers', name: 'Transit Mixers', count: '12', icon: 'fa-truck', logoUrl: '' },
  { key: 'pumps', name: 'Schwing Stetter S36X Boom Pumps', count: '2', icon: 'fa-truck-droplet', logoUrl: '' },
  { key: 'tippers', name: 'Tipper Trucks', count: '15', icon: 'fa-truck-moving', logoUrl: '' },
  { key: 'excavators', name: 'Excavators & JCBS', count: '4', icon: 'fa-tractor', logoUrl: '' },
  { key: 'crushers', name: 'Crusher Units', count: '3', icon: 'fa-gears', logoUrl: '' },
  { key: 'quarries', name: 'Blue Metal Quarries', count: '3', icon: 'fa-mountain', logoUrl: '' },
  { key: 'bending', name: 'Bar Bending Machines', count: '2', icon: 'fa-screwdriver-wrench', logoUrl: '' },
  { key: 'shearing', name: 'Bar Shearing Machines', count: '2', icon: 'fa-scissors', logoUrl: '' },
  { key: 'scaffolding', name: 'Scaffolding Pipes', count: '30k', icon: 'fa-layer-group', logoUrl: '' },
];

const turnoverSeries = [
  { year: '2020-21', amount: 560, source: 'published', visible: true },
  { year: '2021-22', amount: 720, source: 'published', visible: true },
  { year: '2022-23', amount: 850, source: 'published', visible: true },
  { year: '2023-24', amount: 990, source: 'published', visible: true },
  { year: '2024-25', amount: 1175, source: 'published', visible: true },
  { year: '2025-26', amount: 1420, source: 'published', visible: true },
  { year: '2026-27', amount: 1650, source: 'published', visible: false },
  { year: '2027-28', amount: 1900, source: 'published', visible: false },
  { year: '2028-29', amount: 2200, source: 'published', visible: false },
  { year: '2029-30', amount: 2500, source: 'published', visible: false },
  { year: '2030-31', amount: 2800, source: 'published', visible: false },
];

const financials = [
  {
    key: 'turnover',
    title: 'Annual Turnover',
    icon: 'fa-chart-line',
    text: 'Our financial progress reached a whopping annual turnover to the tune of Rs.1420 millions during the Financial Year 2025–26.',
    currency: 'inr_millions',
  },
  {
    key: 'resources',
    title: 'Financial Resources',
    icon: 'fa-vault',
    text: 'The financial credibility of the firm has enabled it to secure a Cash Credit Limit of Rs.10.00 Crore and Bank Guarantee Limit of Rs. 25.00 Crore from HDFC, Kalpakkam. Besides this, we are well supported by Banks and Partners.',
  },
  {
    key: 'quality',
    title: 'Quality Assurance',
    icon: 'fa-award',
    text: 'Timely completion with Absolute Quality Control has long been the specialty of Sekar Constructions. Continuous orders from the Department of Atomic Energy and allied premier institutions stand as evidence of that commitment.',
  },
];

const teamPhotos = [
  { id: 'img-1', url: 'dynamic-team-1.jpg', caption: 'Sekar Constructions Executive Team' },
  { id: 'img-2', url: 'dynamic-team-2.jpg', caption: 'Sekar Constructions Engineering Team on Site' },
  { id: 'img-3', url: 'dynamic-team-3.jpg', caption: 'Sekar Constructions Civil Work Force' },
];

/** Gallery submenu pages: plant & machinery, founder & clients, certificates (+ logo strips). */
const galleryMedia = {
  plant_machinery: [
    {
      id: 'plant-schwing-m1c-1',
      url: 'images/plant-machinery/schwing-stetter-m1c-ecr-manamai-1.png',
      title: 'Schwing Stetter M1C Batching Plant',
      badge: 'Batching Plant',
      location: 'ECR, Manamai, Tamil Nadu',
      locationIcon: 'fa-location-dot',
      description:
        'Owned high-capacity concrete batching plant supporting coastal infrastructure & Class-I civil works along ECR corridor.',
    },
    {
      id: 'plant-schwing-m1c-2',
      url: 'images/plant-machinery/schwing-stetter-m1c-ecr-manamai-2.png',
      title: 'Aggregate Conveyor & Batching Unit',
      badge: 'Concrete Production',
      location: 'ECR, Manamai, Tamil Nadu',
      locationIcon: 'fa-location-dot',
      description:
        'Automated aggregate feeding and continuous concrete mixing setup for high-grade structural pours.',
    },
    {
      id: 'plant-schwing-transit',
      url: 'images/plant-machinery/schwing-stetter-m1c-transit-mixer.png',
      title: 'Schwing Stetter M1C & Transit Mixer Fleet',
      badge: 'Transit Operations',
      location: 'ECR, Manamai, Tamil Nadu',
      locationIcon: 'fa-location-dot',
      description:
        'Direct transit mixer loading for seamless concrete delivery across major industrial & infrastructure project sites.',
    },
    {
      id: 'plant-yellow-silo',
      url: 'images/plant-machinery/batching-plant-yellow-silo.png',
      title: 'Vertical Cement & Flyash Storage Silo',
      badge: 'Storage & Dosage',
      location: 'Site Plant Facility, Tamil Nadu',
      locationIcon: 'fa-location-dot',
      description:
        'High-capacity vertical silo storage system ensuring continuous supply of raw cementitious materials.',
    },
    {
      id: 'plant-aquarius',
      url: 'images/plant-machinery/aquarius-batching-plant.png',
      title: 'Aquarius Batching Plant & Control Cabin',
      badge: 'Plant Fleet',
      location: 'Project Asset Line, Tamil Nadu',
      locationIcon: 'fa-location-dot',
      description:
        'Automated batching control system and aggregate bin feeder for specialized structural concrete grades.',
    },
    {
      id: 'plant-boom-pump',
      url: 'images/plant-machinery/schwing-stetter-s36x-boom-pump.jpg',
      title: 'Schwing Stetter S36X Concrete Boom Pump',
      badge: 'Boom Pump (2 Nos)',
      location: 'Site Equipment Fleet, Tamil Nadu',
      locationIcon: 'fa-location-dot',
      description:
        'Heavy-duty truck-mounted 36-meter concrete placing boom pump (2 Nos) owned for high-reach structural pours & rapid placement.',
    },
    {
      id: 'plant-transit-fleet',
      url: 'images/plant-machinery/sekar-constructions-transit-mixer-fleet.jpg',
      title: 'Transit Mixer Fleet & Batching Base',
      badge: 'Transit Fleet',
      location: 'ECR Batching Yard, Tamil Nadu',
      locationIcon: 'fa-location-dot',
      description:
        'Owned fleet of high-capacity transit mixers lined up at site batching facility for uninterrupted RMC supply.',
    },
  ],
  founder_clients: [
    {
      id: 'founder-isro-shawl',
      url: 'images/isro-chairman-felicitating-sekar-shawl.jpg',
      title: 'Felicitation by ISRO Chairman Dr. S. Somanath',
      badge: 'ISRO Felicitation',
      location: 'IPRC, Mahendragiri, Tamil Nadu',
      locationIcon: 'fa-rocket',
      description:
        'ISRO Chairman Dr. S. Somanath honouring Mr. Ethiraj Sekar with a traditional golden shawl during the inauguration of the C25 Stage Integration Complex.',
    },
    {
      id: 'founder-isro-bouquet',
      url: 'images/isro-chairman-felicitating-sekar-bouquet.jpg',
      title: 'C25 Stage Integration Complex Inauguration',
      badge: 'Inauguration & Award',
      location: 'ISRO Propulsion Complex (IPRC), Mahendragiri',
      locationIcon: 'fa-award',
      description:
        'Dr. S. Somanath presenting floral honors during the inauguration & award function for successful completion of the C25 Stage Integration Complex & area development works.',
    },
    {
      id: 'founder-gl-blueprint',
      url: 'images/great-lakes-site-blueprint-review.jpg',
      title: 'Engineering Blueprint Review — Great Lakes Campus',
      badge: 'Site Inspection',
      location: 'ECR, Manamai, Tamil Nadu',
      locationIcon: 'fa-location-dot',
      description:
        'Mr. Ethiraj Sekar and senior engineering management inspecting structural drawings for Class Rooms, Residential Quarters & Compound Wall at Great Lakes Institute of Management.',
    },
    {
      id: 'founder-gl-award',
      url: 'images/great-lakes-award-function-bala-balachandran.jpg',
      title: 'Award & Appreciation Function — Great Lakes Campus',
      badge: 'Award & Recognition',
      location: 'ECR, Manamai (Near Mamallapuram), TN',
      locationIcon: 'fa-trophy',
      description:
        'Felicitation and appreciation award presentation by Founder Dr. Bala V. Balachandran at Great Lakes Institute of Management for milestone campus delivery.',
    },
    {
      id: 'founder-dignitaries',
      url: 'images/site-inspection-dignitaries.png',
      title: 'Site Inspection with Senior Officers & Dignitaries',
      badge: 'Dignitary Visit',
      location: 'Institutional Site, Tamil Nadu',
      locationIcon: 'fa-shield-halved',
      description:
        'Mr. Ethiraj Sekar interacting with senior IPS officers and government dignitaries during high-security facility site reviews.',
    },
  ],
  certificates: [
    {
      id: 'cert-isro-c25',
      url: 'images/certificates/certificate-isro-c25-stage-integration-complex.jpg',
      title: 'C25 Stage Integration Complex — ISRO Propulsion Complex',
      badge: 'ISRO Certificate of Experience',
      badgeIcon: 'fa-rocket',
      author: '<strong>Government of India — Department of Space</strong> | ISRO Mahendragiri',
      description:
        'Official Certificate of Experience for execution of C25 Stage Integration Complex (₹56.30 Crore value). High Bays 26m height cleanroom, 11,380 sqm plinth area, 13,300 CUM RCC concrete, and 2,388 MT steel reinforcement executed with zero defects.',
      meta: [
        { icon: 'fa-check-double', text: 'Value: ₹56.30 Cr' },
        { icon: 'fa-file-signature', text: 'Performance: Satisfactory' },
      ],
    },
    {
      id: 'cert-great-lakes-letter',
      url: 'images/appreciation-letter-great-lakes-dr-bala-balachandran.png',
      title: 'Letter of Appreciation — Great Lakes Institute of Management',
      badge: 'Client Recommendation',
      badgeIcon: 'fa-certificate',
      author:
        '<strong>Dr. Bala V. Balachandran</strong> (Founder & Dean, Great Lakes Institute of Management; Kellogg Professor, Northwestern University)',
      quote:
        '"Choosing Sekar to convert our architectural plans into brick and mortar was the best decision we made. Sekar has not only breathed life into our buildings, but did it so effortlessly... Thanks for your outstanding service to Great Lakes beyond imagination!"',
      meta: [
        { icon: 'fa-award', text: '28-Acre LEED Platinum Campus' },
        { icon: 'fa-calendar-days', text: 'Official Letter of Recommendation' },
      ],
    },
    {
      id: 'cert-dae-quarters',
      url: 'images/certificates/certificate-dae-116-quarters-performance-report.png',
      title: '116 Type II-B Residential Quarters — DAE Township, Kalpakkam',
      badge: 'DAE Performance Report (Form-E)',
      badgeIcon: 'fa-atom',
      author: '<strong>Department of Atomic Energy (DAE)</strong> | Government of India',
      description:
        'Official Form-E Performance Report (Completed Cost: ₹25.83 Crore / Rs. 2,583.04 Lakhs). Completed on schedule with <strong>Very Good</strong> performance ratings across Quality of Work, Financial Soundness, Technical Proficiency, Resourcefulness, and Time Consciousness.',
      meta: [
        { icon: 'fa-circle-check', text: 'Value: ₹25.83 Cr' },
        { icon: 'fa-star', text: 'Performance: VERY GOOD' },
      ],
    },
    {
      id: 'cert-igcar-ausc',
      url: 'images/certificates/certificate-igcar-ausc-lab-performance-report.png',
      title: 'High Temperature Advance Facility — IGCAR Kalpakkam',
      badge: 'IGCAR Performance Report',
      badgeIcon: 'fa-microscope',
      author: '<strong>Indira Gandhi Centre for Atomic Research (IGCAR)</strong> | Chief Engineer N. Suresh',
      description:
        'Official Performance Report for Development and Testing Studies of High Temperature Advance Facility (AUSC Lab Building, ₹13.12 Crore value). Rated <strong>Very Good</strong> across Quality of Work, Technical Proficiency, Resourcefulness, and Adherence of Time Schedule.',
      meta: [
        { icon: 'fa-building-circle-check', text: 'Value: ₹13.12 Cr' },
        { icon: 'fa-shield-check', text: 'Rating: VERY GOOD' },
      ],
    },
    {
      id: 'cert-cmwssb-150',
      url: 'images/certificates/certificate-cmwssb-150mld-desalination.png',
      title: '150 MLD Seawater Desalination Plant — CMWSSB Nemmeli',
      badge: 'CMWSSB Official Certificate',
      badgeIcon: 'fa-droplet',
      author: '<strong>Chennai Metropolitan Water Supply & Sewerage Board</strong> | Chief Engineer A. Malaichamy',
      description:
        'Official Certificate of Experience confirming successful execution of structural concrete water-retaining basins, intake structures, and pump house civil works for the 150 MLD Nemmeli SWRO Desalination facility.',
      meta: [
        { icon: 'fa-water', text: 'Water Retaining Structures' },
        { icon: 'fa-certificate', text: 'Signed by Chief Engineer' },
      ],
    },
    {
      id: 'cert-cobra-completion',
      url: 'images/certificates/certificate-cobratecton-150mld-completion.png',
      title: '150 MLD Desalination Civil & RMC Works — Nemmeli',
      badge: 'COBRA-TECTON Completion Certificate',
      badgeIcon: 'fa-industry',
      author: '<strong>COBRA TECTON Private Limited</strong> | General Manager Construction D. Anbuselvarani',
      description:
        'Completion Certificate for ₹56.95 Crore civil works (₹42.60 Cr main civil + ₹3.92 Cr RMC supply + materials hire). Plinth area 5,600+ sqm, 17,777 CUM concrete, 46,545 sqm formwork, and 2,016 MT steel. Performance: <strong>Very Good</strong>.',
      meta: [
        { icon: 'fa-coins', text: 'Value: ₹56.95 Cr' },
        { icon: 'fa-star', text: 'Performance: VERY GOOD' },
      ],
    },
    {
      id: 'cert-cobra-appreciation',
      url: 'images/certificates/certificate-cobratecton-appreciation-letter.png',
      title: 'Letter of Appreciation — COBRA TECTON Private Limited',
      badge: 'Letter of Commendation',
      badgeIcon: 'fa-heart-pulse',
      author: '<strong>COBRA TECTON Consortium</strong> | 150 MLD Nemmeli SWRO Project',
      quote:
        '"M/s. Sekar Constructions commitment to quality, adherence to safety standards, and timely execution of civil works have been commendable and have significantly contributed to the successful progression of this critical infrastructure project."',
      meta: [
        { icon: 'fa-truck-ramp-box', text: 'RMC & Scaffolding Supply' },
        { icon: 'fa-award', text: 'Valued Infrastructure Partner' },
      ],
    },
  ],
  founder_logos: [
    { id: 'logo-strip-1', url: 'images/clients-logos-strip-1.png' },
    { id: 'logo-strip-2', url: 'images/clients-logos-strip-2.png' },
    { id: 'logo-strip-3', url: 'images/clients-logos-strip-3.png' },
    { id: 'logo-strip-4', url: 'images/clients-logos-strip-4.png' },
    { id: 'logo-strip-5', url: 'images/clients-logos-strip-5.png' },
  ],
};

/** No seed inquiries — real submissions only via POST /api/inquiries */
const sampleInquiries = [];

module.exports = {
  infrastructure,
  ongoing,
  completed,
  gallery,
  fleet,
  turnoverSeries,
  financials,
  teamPhotos,
  galleryMedia,
  sampleInquiries,
  /** Local seed fallback only when SEED_ADMIN_PASSWORD is unset. Never for production. */
  LOCAL_ADMIN: {
    username: 'superadmin',
  },
};

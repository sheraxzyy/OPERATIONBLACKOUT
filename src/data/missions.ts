import type { MissionDef } from '../core/types';

/**
 * Campaign: four operations in each of five sectors. Objective zones exist on
 * every map (objectiveA–E). All missions end with a physical extraction.
 */
export const MISSIONS: MissionDef[] = [
  // ── BLACKWOOD FOREST ─────────────────────────────────────────────────────
  {
    id: 'bw1',
    mapId: 'blackwood',
    order: 1,
    regionOrder: 1,
    codename: 'SILENT CANOPY',
    name: 'THE FIRST SIGNAL',
    briefing:
      'Three days after the global blackout, a Black Veil relay began broadcasting from the Blackwood timberline. Task Force 09 is inserted west of a ranger lodge to recover the relay logs and confirm the enemy presence. Keep noise discipline; the forest carries sound.',
    intel:
      'Relay broadcasts on a rotating frequency. A single patrol screens the lodge. Resistance is expected to be light, but these are not irregulars — they move like professionals.',
    objectives: [
      { id: 'bw1-elim', type: 'eliminate', label: 'Clear Black Veil patrols around the lodge', count: 5 },
      { id: 'bw1-intel', type: 'intel', label: 'Recover the relay logs from the lodge', zone: 'objectiveA', hint: 'The drive is on the radio desk.' },
      { id: 'bw1-extract', type: 'extract', label: 'Exfiltrate to the eastern LZ', zone: 'extraction' },
    ],
    enemyCount: 8,
    enemyMix: ['patrol', 'patrol', 'guard'],
    eliteChance: 0,
    rewards: { credits: 1100, xp: 280 },
    recommendedLevel: 1,
    timeOfDay: 'dusk',
    weather: 'fog',
  },
  {
    id: 'bw2',
    mapId: 'blackwood',
    order: 2,
    regionOrder: 2,
    codename: 'COLD TRAIL',
    name: 'THE FORESTER',
    briefing:
      'A forest ranger has been transmitting on a civilian band from an outpost south of the main road. She has mapped Black Veil patrol routes for two weeks. Find her, recover her survey drives, and bring her home.',
    intel:
      'The ranger is held in the southern outpost. Two patrols rotate through the logging road every six minutes. Sniper overwatch has been reported near the eastern cabin.',
    objectives: [
      { id: 'bw2-intel1', type: 'intel', label: 'Recover the survey drive from the eastern cabin', zone: 'objectiveB' },
      { id: 'bw2-rescue', type: 'rescue', label: 'Rescue the ranger from the southern outpost', zone: 'objectiveC' },
      { id: 'bw2-elim', type: 'eliminate', label: 'Eliminate the pursuit patrols', count: 9 },
      { id: 'bw2-extract', type: 'extract', label: 'Escort the ranger to the extraction LZ', zone: 'extraction' },
    ],
    enemyCount: 12,
    enemyMix: ['patrol', 'guard', 'assault', 'sniper'],
    eliteChance: 0.05,
    rewards: { credits: 1500, xp: 360 },
    recommendedLevel: 3,
    timeOfDay: 'night',
    weather: 'rain',
  },
  {
    id: 'bw3',
    mapId: 'blackwood',
    order: 3,
    regionOrder: 3,
    codename: 'RANGER DOWN',
    name: 'NO ONE LEFT BEHIND',
    briefing:
      'A TF-09 observation flight went down over the northern ridge. The pilot, callsign RAVEN, is alive and evading. Black Veil has flooded the area. Reach her before the hunter teams do and clear a corridor to the LZ.',
    intel:
      'RAVEN has military training and a sidearm. She is barricaded in the supply shed northeast of the ridge. Heavy resistance is moving in from the north and west.',
    objectives: [
      { id: 'bw3-rescue', type: 'rescue', label: 'Reach and secure RAVEN at the supply shed', zone: 'objectiveD' },
      { id: 'bw3-elim', type: 'eliminate', label: 'Break the Black Veil hunter teams', count: 12 },
      { id: 'bw3-extract', type: 'extract', label: 'Get RAVEN to the extraction LZ', zone: 'extraction' },
    ],
    enemyCount: 15,
    enemyMix: ['patrol', 'guard', 'assault', 'sniper', 'heavy'],
    eliteChance: 0.1,
    rewards: { credits: 1900, xp: 440 },
    recommendedLevel: 4,
    timeOfDay: 'night',
    weather: 'storm',
  },
  {
    id: 'bw4',
    mapId: 'blackwood',
    order: 4,
    regionOrder: 4,
    codename: 'TIMBERLINE SIEGE',
    name: 'CUT THE CORD',
    briefing:
      'The Blackwood relay is the northern anchor of the Black Veil network. Two hardened nodes remain: a signal mast at the ridge and a power relay in the eastern cabin. Destroy both, then exfiltrate before the response force seals the valley.',
    intel:
      'Structures are reinforced. Thermite or sustained fire will be required. A heavy gunner guards the eastern node; expect a coordinated counterattack once the first node falls.',
    objectives: [
      { id: 'bw4-destroy1', type: 'destroy', label: 'Destroy the ridge signal mast', zone: 'objectiveA' },
      { id: 'bw4-destroy2', type: 'destroy', label: 'Destroy the eastern power relay', zone: 'objectiveB' },
      { id: 'bw4-elim', type: 'eliminate', label: 'Eliminate the response force', count: 14 },
      { id: 'bw4-extract', type: 'extract', label: 'Exfiltrate before the valley is sealed', zone: 'extraction' },
    ],
    enemyCount: 18,
    enemyMix: ['guard', 'assault', 'sniper', 'heavy'],
    eliteChance: 0.16,
    rewards: { credits: 2400, xp: 560 },
    recommendedLevel: 6,
    timeOfDay: 'day',
    weather: 'rain',
  },

  // ── DEAD DISTRICT ────────────────────────────────────────────────────────
  {
    id: 'dd1',
    mapId: 'dead_district',
    order: 5,
    regionOrder: 1,
    codename: 'ASHES OF ARDEN',
    name: 'EMPTY STREETS',
    briefing:
      'Arden was the first city to go dark. Black Veil has turned the eastern district into a staging ground. We need their movement logs and a route through the city for the main assault. Enter from the south and use the dead ground.',
    intel:
      'Drone imagery shows patrols on the main avenue and a command element in the apartments. Civilians are gone. Every silhouette is hostile.',
    objectives: [
      { id: 'dd1-intel', type: 'intel', label: 'Recover the movement logs from the housing block', zone: 'objectiveA' },
      { id: 'dd1-elim', type: 'eliminate', label: 'Clear Black Veil checkpoints', count: 10 },
      { id: 'dd1-extract', type: 'extract', label: 'Link up at the eastern extraction point', zone: 'extraction' },
    ],
    enemyCount: 13,
    enemyMix: ['patrol', 'guard', 'assault', 'sniper'],
    eliteChance: 0.08,
    rewards: { credits: 2100, xp: 480 },
    recommendedLevel: 5,
    timeOfDay: 'dusk',
    weather: 'fog',
  },
  {
    id: 'dd2',
    mapId: 'dead_district',
    order: 6,
    regionOrder: 2,
    codename: 'THE QUIET BLOCK',
    name: 'SAFE PASSAGE',
    briefing:
      'A city engineer named Mara Voss built the Black Veil communications grid. She is hiding in the clinic on the eastern block with a copy of the network map. Black Veil has offered a bounty for her. Get to her first.',
    intel:
      'Voss is unarmed and terrified. A guard section occupies the school to the west, and a sniper has overwatch on the main avenue. Avoid the open road.',
    objectives: [
      { id: 'dd2-intel', type: 'intel', label: 'Recover Voss\'s network map from the housing block', zone: 'objectiveA' },
      { id: 'dd2-rescue', type: 'rescue', label: 'Extract Voss from the clinic', zone: 'objectiveE' },
      { id: 'dd2-elim', type: 'eliminate', label: 'Neutralise the bounty hunter section', count: 11 },
      { id: 'dd2-extract', type: 'extract', label: 'Bring Voss to the southern extraction', zone: 'extraction' },
    ],
    enemyCount: 14,
    enemyMix: ['patrol', 'guard', 'assault', 'sniper'],
    eliteChance: 0.1,
    rewards: { credits: 2400, xp: 540 },
    recommendedLevel: 7,
    timeOfDay: 'night',
    weather: 'rain',
  },
  {
    id: 'dd3',
    mapId: 'dead_district',
    order: 7,
    regionOrder: 3,
    codename: 'CROSSFIRE',
    name: 'HOLD THE LINE',
    briefing:
      'A resistance cell is pinned in the school. They have agreed to hand over a Black Veil cipher if we hold the intersection long enough for their radio operator to finish transmitting. Black Veil will try to overrun the position.',
    intel:
      'Expect waves from the east and north. The school has two entrances and limited cover. Destroy their breaching equipment at the garage and shops to slow the assault.',
    objectives: [
      { id: 'dd3-destroy1', type: 'destroy', label: 'Destroy the breaching APC at the shops', zone: 'objectiveC' },
      { id: 'dd3-destroy2', type: 'destroy', label: 'Destroy the ammunition stockpile at the garage', zone: 'objectiveE' },
      { id: 'dd3-survive', type: 'survive', label: 'Hold the intersection for 90 seconds', seconds: 90 },
      { id: 'dd3-extract', type: 'extract', label: 'Withdraw to the extraction point', zone: 'extraction' },
    ],
    enemyCount: 16,
    enemyMix: ['assault', 'heavy', 'guard', 'sniper', 'patrol'],
    eliteChance: 0.15,
    rewards: { credits: 2800, xp: 620 },
    recommendedLevel: 8,
    timeOfDay: 'night',
    weather: 'storm',
  },
  {
    id: 'dd4',
    mapId: 'dead_district',
    order: 8,
    regionOrder: 4,
    codename: 'BLACKOUT PROTOCOL',
    name: 'THE ARCHIVE',
    briefing:
      'Voss\'s map points to a Black Veil archive hidden across three buildings in Arden. If we recover all three data cores, we can expose the organisation and find the route to Iron Fortress. This is the intelligence coup of the war.',
    intel:
      'Each core is in a separate strongpoint. Assume the enemy knows we are coming. The archive is protected by elite heavy gunners and at least one marksman.',
    objectives: [
      { id: 'dd4-intel1', type: 'intel', label: 'Recover archive core ALPHA from the housing block', zone: 'objectiveA' },
      { id: 'dd4-intel2', type: 'intel', label: 'Recover archive core BRAVO from the apartments', zone: 'objectiveB' },
      { id: 'dd4-intel3', type: 'intel', label: 'Recover archive core CHARLIE from the shops', zone: 'objectiveC' },
      { id: 'dd4-elim', type: 'eliminate', label: 'Eliminate the archive protection detail', count: 16 },
      { id: 'dd4-extract', type: 'extract', label: 'Exfiltrate through the southern rail cut', zone: 'extraction' },
    ],
    enemyCount: 20,
    enemyMix: ['guard', 'assault', 'sniper', 'heavy'],
    eliteChance: 0.2,
    rewards: { credits: 3400, xp: 760 },
    recommendedLevel: 10,
    timeOfDay: 'dusk',
    weather: 'clear',
  },

  // ── IRON FORTRESS ────────────────────────────────────────────────────────
  {
    id: 'if1',
    mapId: 'iron_fortress',
    order: 9,
    regionOrder: 1,
    codename: 'BREACH POINT',
    name: 'THE OUTER WALL',
    briefing:
      'The Iron Fortress is the main Black Veil logistics hub in the north. Our assault begins with a covert breach. Destroy the armory gate, reach the command annex, and open a corridor for the follow-on force.',
    intel:
      'The armory gate is reinforced but vulnerable to concentrated fire. Barracks to the west will respond quickly. The command annex has a hardened security detail.',
    objectives: [
      { id: 'if1-destroy', type: 'destroy', label: 'Destroy the armory security gate', zone: 'objectiveD' },
      { id: 'if1-reach', type: 'reach', label: 'Reach the command annex', zone: 'objectiveC' },
      { id: 'if1-elim', type: 'eliminate', label: 'Eliminate the outer garrison', count: 15 },
      { id: 'if1-extract', type: 'extract', label: 'Open the route and reach extraction', zone: 'extraction' },
    ],
    enemyCount: 19,
    enemyMix: ['guard', 'patrol', 'assault', 'sniper', 'heavy'],
    eliteChance: 0.18,
    rewards: { credits: 3600, xp: 820 },
    recommendedLevel: 11,
    timeOfDay: 'day',
    weather: 'clear',
  },
  {
    id: 'if2',
    mapId: 'iron_fortress',
    order: 10,
    regionOrder: 2,
    codename: 'STEEL RAIN',
    name: 'DISARM THE YARD',
    briefing:
      'Three hardened nodes keep Iron Fortress\'s air-defence net alive: a radar mast above the hangar, the motor-pool generator, and the watchtower uplink. Destroy all three in one push before the garrison can organise.',
    intel:
      'The nodes are spread across the base. Expect armour in the motor pool and a heavy response once the radar goes down. Use the perimeter containers for cover.',
    objectives: [
      { id: 'if2-destroy1', type: 'destroy', label: 'Destroy the hangar radar mast', zone: 'objectiveB' },
      { id: 'if2-destroy2', type: 'destroy', label: 'Destroy the motor-pool generator', zone: 'objectiveE' },
      { id: 'if2-destroy3', type: 'destroy', label: 'Destroy the watchtower uplink', zone: 'objectiveA' },
      { id: 'if2-elim', type: 'eliminate', label: 'Break the base defence force', count: 18 },
      { id: 'if2-extract', type: 'extract', label: 'Reach the eastern extraction', zone: 'extraction' },
    ],
    enemyCount: 22,
    enemyMix: ['guard', 'assault', 'sniper', 'heavy'],
    eliteChance: 0.22,
    rewards: { credits: 4200, xp: 940 },
    recommendedLevel: 12,
    timeOfDay: 'dusk',
    weather: 'rain',
  },
  {
    id: 'if3',
    mapId: 'iron_fortress',
    order: 11,
    regionOrder: 3,
    codename: 'THE BRIG',
    name: 'CELL BLOCK NINE',
    briefing:
      'Six TF-09 operatives have been held in the Iron Fortress brig since the first night. We are not leaving them. Breach the command annex, find the detention ledger, and secure the prisoners before they are moved.',
    intel:
      'The brig is beneath the command annex. The detention ledger is in the barracks. A sniper covers the open yard from the watchtower; smoke and vehicles are recommended.',
    objectives: [
      { id: 'if3-intel', type: 'intel', label: 'Recover the detention ledger from the barracks', zone: 'objectiveA' },
      { id: 'if3-rescue', type: 'rescue', label: 'Breach the brig and rescue the operatives', zone: 'objectiveC' },
      { id: 'if3-elim', type: 'eliminate', label: 'Eliminate the prison guard detail', count: 14 },
      { id: 'if3-extract', type: 'extract', label: 'Escort the operatives to extraction', zone: 'extraction' },
    ],
    enemyCount: 18,
    enemyMix: ['guard', 'assault', 'sniper', 'heavy', 'patrol'],
    eliteChance: 0.2,
    rewards: { credits: 4800, xp: 1060 },
    recommendedLevel: 14,
    timeOfDay: 'night',
    weather: 'fog',
  },
  {
    id: 'if4',
    mapId: 'iron_fortress',
    order: 12,
    regionOrder: 4,
    codename: 'IRON COMMAND',
    name: 'THE GENERAL',
    briefing:
      'Our intelligence points to General Kessler, Black Veil\'s northern commander, running the war from Iron Fortress. Simultaneously destroy his communications, recover his operational orders, and eliminate his command staff before they can relocate.',
    intel:
      'Kessler travels with a heavy protective detail. The base will go to full alert the moment we are detected. There is no stealth once the command post is breached.',
    objectives: [
      { id: 'if4-intel1', type: 'intel', label: 'Recover the operational orders from the command annex', zone: 'objectiveC' },
      { id: 'if4-intel2', type: 'intel', label: 'Recover the prisoner ledger from the barracks', zone: 'objectiveA' },
      { id: 'if4-destroy', type: 'destroy', label: 'Destroy the command communications array', zone: 'objectiveB' },
      { id: 'if4-elim', type: 'eliminate', label: 'Eliminate the command staff', count: 20 },
      { id: 'if4-extract', type: 'extract', label: 'Escape the fortress before lockdown', zone: 'extraction' },
    ],
    enemyCount: 25,
    enemyMix: ['guard', 'assault', 'sniper', 'heavy', 'patrol'],
    eliteChance: 0.28,
    rewards: { credits: 5600, xp: 1250 },
    recommendedLevel: 16,
    timeOfDay: 'day',
    weather: 'storm',
  },

  // ── DUST VALLEY ──────────────────────────────────────────────────────────
  {
    id: 'dv1',
    mapId: 'dust_valley',
    order: 13,
    regionOrder: 1,
    codename: 'DRY LIGHTNING',
    name: 'CARAVAN',
    briefing:
      'Black Veil is moving communications equipment through Sahrak Pass under cover of the desert heat. Intercept the caravan at the old adobe compound and recover their route manifest before it reaches Zero Point.',
    intel:
      'The caravan is lightly guarded leaving the compound, but a quick-reaction force is staged at the depot. Open ground offers little cover; use the rock line to the north.',
    objectives: [
      { id: 'dv1-intel', type: 'intel', label: 'Recover the caravan manifest from the compound', zone: 'objectiveA' },
      { id: 'dv1-elim', type: 'eliminate', label: 'Eliminate the caravan escort', count: 12 },
      { id: 'dv1-extract', type: 'extract', label: 'Exfiltrate through the eastern wadi', zone: 'extraction' },
    ],
    enemyCount: 15,
    enemyMix: ['patrol', 'guard', 'assault', 'sniper'],
    eliteChance: 0.12,
    rewards: { credits: 3200, xp: 700 },
    recommendedLevel: 9,
    timeOfDay: 'day',
    weather: 'sandstorm',
  },
  {
    id: 'dv2',
    mapId: 'dust_valley',
    order: 14,
    regionOrder: 2,
    codename: 'SANDSTORM',
    name: 'THE DRIVER',
    briefing:
      'A Black Veil driver defected after learning what the convoy carried. He is hiding in the adobe house with a sample of the cargo. The depot guards are already searching for him. Find him, secure the sample, and destroy the depot\'s tracking station.',
    intel:
      'The defector is unarmed but knows the desert. The depot has a hardened tracking array; it must be destroyed or Zero Point will see our extraction.',
    objectives: [
      { id: 'dv2-rescue', type: 'rescue', label: 'Rescue the defector from the adobe house', zone: 'objectiveB' },
      { id: 'dv2-destroy', type: 'destroy', label: 'Destroy the depot tracking station', zone: 'objectiveC' },
      { id: 'dv2-elim', type: 'eliminate', label: 'Eliminate the search party', count: 13 },
      { id: 'dv2-extract', type: 'extract', label: 'Bring the defector to the extraction', zone: 'extraction' },
    ],
    enemyCount: 16,
    enemyMix: ['guard', 'assault', 'sniper', 'heavy', 'patrol'],
    eliteChance: 0.15,
    rewards: { credits: 3800, xp: 840 },
    recommendedLevel: 11,
    timeOfDay: 'dusk',
    weather: 'sandstorm',
  },
  {
    id: 'dv3',
    mapId: 'dust_valley',
    order: 15,
    regionOrder: 3,
    codename: 'CONVOY INTERDICTION',
    name: 'IRON SNAKE',
    briefing:
      'A Black Veil convoy carrying reactor components is crossing Sahrak Pass. Two armoured vehicles must be disabled and the cargo destroyed. This is the last chance to stop the components reaching Zero Point.',
    intel:
      'The convoy halted near the depot and garage. Heavy gunners ride with the cargo. Destroy the command truck and the fuel bowser, then break contact before air support arrives.',
    objectives: [
      { id: 'dv3-destroy1', type: 'destroy', label: 'Destroy the convoy command truck at the depot', zone: 'objectiveC' },
      { id: 'dv3-destroy2', type: 'destroy', label: 'Destroy the fuel bowser at the garage', zone: 'objectiveD' },
      { id: 'dv3-elim', type: 'eliminate', label: 'Eliminate the convoy security', count: 16 },
      { id: 'dv3-extract', type: 'extract', label: 'Break contact and reach extraction', zone: 'extraction' },
    ],
    enemyCount: 20,
    enemyMix: ['assault', 'heavy', 'guard', 'sniper', 'patrol'],
    eliteChance: 0.22,
    rewards: { credits: 4400, xp: 980 },
    recommendedLevel: 13,
    timeOfDay: 'day',
    weather: 'clear',
  },
  {
    id: 'dv4',
    mapId: 'dust_valley',
    order: 16,
    regionOrder: 4,
    codename: 'THE LONG WALK',
    name: 'MIRAGE',
    briefing:
      'Our extraction was compromised. The team is stranded in the valley with a captured Black Veil scientist and no air support. Hold the compound until the emergency pick-up can cross the border, then move on foot to the alternate LZ.',
    intel:
      'Enemy reinforcements will arrive from north and east. The compound walls are solid, but the rear approach is exposed. Conserve ammunition and use the vehicle if it is still serviceable.',
    objectives: [
      { id: 'dv4-rescue', type: 'rescue', label: 'Secure the Black Veil scientist', zone: 'objectiveE' },
      { id: 'dv4-survive', type: 'survive', label: 'Hold the compound for 120 seconds', seconds: 120 },
      { id: 'dv4-elim', type: 'eliminate', label: 'Repel the reinforcement waves', count: 18 },
      { id: 'dv4-extract', type: 'extract', label: 'Make the long walk to the alternate LZ', zone: 'extraction' },
    ],
    enemyCount: 22,
    enemyMix: ['assault', 'heavy', 'guard', 'sniper', 'patrol'],
    eliteChance: 0.26,
    rewards: { credits: 5200, xp: 1160 },
    recommendedLevel: 15,
    timeOfDay: 'dusk',
    weather: 'sandstorm',
  },

  // ── ZERO POINT ───────────────────────────────────────────────────────────
  {
    id: 'zp1',
    mapId: 'zero_point',
    order: 17,
    regionOrder: 1,
    codename: 'WHITEOUT',
    name: 'COLD OPEN',
    briefing:
      'Zero Point is a black site built under the arctic ice. It is the source of the global blackout and the heart of Black Veil. Our first objective is the research lab. Recover the reactor telemetry and destroy the surface antenna so they cannot call for help.',
    intel:
      'Arctic conditions reduce visibility to under 200 metres. Thermal signatures are masked by the storm. Expect elite guards and automated defences around the reactor.',
    objectives: [
      { id: 'zp1-intel', type: 'intel', label: 'Recover reactor telemetry from the research lab', zone: 'objectiveA' },
      { id: 'zp1-destroy', type: 'destroy', label: 'Destroy the surface communications antenna', zone: 'objectiveC' },
      { id: 'zp1-elim', type: 'eliminate', label: 'Eliminate the surface security detail', count: 14 },
      { id: 'zp1-extract', type: 'extract', label: 'Reach the extraction before the storm closes', zone: 'extraction' },
    ],
    enemyCount: 18,
    enemyMix: ['guard', 'assault', 'sniper', 'heavy'],
    eliteChance: 0.25,
    rewards: { credits: 5000, xp: 1100 },
    recommendedLevel: 15,
    timeOfDay: 'night',
    weather: 'snow',
  },
  {
    id: 'zp2',
    mapId: 'zero_point',
    order: 18,
    regionOrder: 2,
    codename: 'COLD STORAGE',
    name: 'THE WITNESSES',
    briefing:
      'Two Zero Point scientists have been held in cold storage since the blackout. They helped build the system — and they know how to shut it down. Reach the storage block and operations centre, and bring both of them out alive.',
    intel:
      'The scientists are in separate facilities. Operations is protected by a heavy reaction team. The cold storage doors are electronically sealed; the guards carry the override codes.',
    objectives: [
      { id: 'zp2-rescue1', type: 'rescue', label: 'Rescue Dr. Okada from cold storage', zone: 'objectiveD' },
      { id: 'zp2-rescue2', type: 'rescue', label: 'Rescue Dr. Soren from operations', zone: 'objectiveE' },
      { id: 'zp2-elim', type: 'eliminate', label: 'Eliminate the facility garrison', count: 16 },
      { id: 'zp2-extract', type: 'extract', label: 'Escort both scientists to extraction', zone: 'extraction' },
    ],
    enemyCount: 21,
    enemyMix: ['guard', 'assault', 'sniper', 'heavy', 'patrol'],
    eliteChance: 0.28,
    rewards: { credits: 6000, xp: 1320 },
    recommendedLevel: 17,
    timeOfDay: 'night',
    weather: 'snow',
  },
  {
    id: 'zp3',
    mapId: 'zero_point',
    order: 19,
    regionOrder: 3,
    codename: 'ZERO HOUR',
    name: 'SCRAMBLE',
    briefing:
      'The reactor is a communication amplifier, not a power source. Its three control arrays must be destroyed to end the blackout. Black Veil knows we are here. They will throw everything into defending the core.',
    intel:
      'Each array is hardened and guarded. Expect heavy resistance and coordinated flanking attacks. Once the arrays are down, the facility will begin emergency shutdown — do not be inside the reactor ring.',
    objectives: [
      { id: 'zp3-destroy1', type: 'destroy', label: 'Destroy reactor control array ALPHA', zone: 'objectiveA' },
      { id: 'zp3-destroy2', type: 'destroy', label: 'Destroy reactor control array BRAVO', zone: 'objectiveB' },
      { id: 'zp3-destroy3', type: 'destroy', label: 'Destroy reactor control array CHARLIE', zone: 'objectiveC' },
      { id: 'zp3-elim', type: 'eliminate', label: 'Eliminate the reactor defence force', count: 19 },
      { id: 'zp3-extract', type: 'extract', label: 'Clear the blast radius', zone: 'extraction' },
    ],
    enemyCount: 24,
    enemyMix: ['assault', 'heavy', 'guard', 'sniper'],
    eliteChance: 0.35,
    rewards: { credits: 7200, xp: 1550 },
    recommendedLevel: 19,
    timeOfDay: 'night',
    weather: 'storm',
  },
  {
    id: 'zp4',
    mapId: 'zero_point',
    order: 20,
    regionOrder: 4,
    codename: 'EVENT HORIZON',
    name: 'END OF THE LINE',
    briefing:
      'General Kessler is at Zero Point. He intends to trigger a second, permanent blackout and collapse the remaining free networks. Task Force 09 has one shot: breach the operations centre, seize the control codes, destroy the final transmitter, and end Black Veil before the countdown completes.',
    intel:
      'All remaining Black Veil forces are concentrated here. Kessler\'s bodyguard is the best they have. There is no reinforcement, no extraction window, and no second attempt. Make it count.',
    objectives: [
      { id: 'zp4-intel', type: 'intel', label: 'Seize the Zero Point control codes', zone: 'objectiveA' },
      { id: 'zp4-destroy', type: 'destroy', label: 'Destroy the final broadcast transmitter', zone: 'objectiveC' },
      { id: 'zp4-survive', type: 'survive', label: 'Survive the counterattack for 60 seconds', seconds: 60 },
      { id: 'zp4-elim', type: 'eliminate', label: 'Eliminate Kessler\'s bodyguard', count: 24 },
      { id: 'zp4-extract', type: 'extract', label: 'Reach the extraction before the facility seals', zone: 'extraction' },
    ],
    enemyCount: 28,
    enemyMix: ['assault', 'heavy', 'guard', 'sniper', 'patrol'],
    eliteChance: 0.4,
    rewards: { credits: 9500, xp: 2100 },
    recommendedLevel: 20,
    timeOfDay: 'night',
    weather: 'storm',
  },
];

export const MISSION_MAP: Record<string, MissionDef> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
);

export function getMission(id: string | undefined): MissionDef {
  return (id && MISSION_MAP[id]) || MISSIONS[0];
}

export const REGIONS = [
  { mapId: 'blackwood', name: 'BLACKWOOD FOREST', code: 'BW', accent: 0x78a06b },
  { mapId: 'dead_district', name: 'DEAD DISTRICT', code: 'DD', accent: 0xa27c62 },
  { mapId: 'iron_fortress', name: 'IRON FORTRESS', code: 'IF', accent: 0x8e9a83 },
  { mapId: 'dust_valley', name: 'DUST VALLEY', code: 'DV', accent: 0xc39a5b },
  { mapId: 'zero_point', name: 'ZERO POINT', code: 'ZP', accent: 0x8fb3c9 },
] as const;

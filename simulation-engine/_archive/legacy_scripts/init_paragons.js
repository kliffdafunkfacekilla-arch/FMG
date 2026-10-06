const { Client } = require('pg');

const STATS = [
    { id: 1, name: 'Might', domain: 'Protection' },
    { id: 2, name: 'Endurance', domain: 'Survival' },
    { id: 3, name: 'Finesse', domain: 'Protection' },
    { id: 4, name: 'Reflex', domain: 'Protection' },
    { id: 5, name: 'Vitality', domain: 'Pleasure' },
    { id: 6, name: 'Fortitude', domain: 'Survival' },
    { id: 7, name: 'Knowledge', domain: 'Survival' },
    { id: 8, name: 'Logic', domain: 'Survival' },
    { id: 9, name: 'Awareness', domain: 'Protection' },
    { id: 10, name: 'Intuition', domain: 'Pleasure' },
    { id: 11, name: 'Charm', domain: 'Pleasure' },
    { id: 12, name: 'Willpower', domain: 'Pleasure' }
];

const TITLES = {
    Civil: ['Mayor', 'Quartermaster', 'Treasurer', 'Guild Master'],
    Security: ['Sergeant', 'Captain', 'General', 'Admiral'],
    Social: ['Friar', 'Priest', 'Bishop', 'Cardinal']
};

function generateParagon(burgId, domain, tierIndex) {
    const high = STATS[Math.floor(Math.random() * 12)];
    let low = STATS[Math.floor(Math.random() * 12)];
    while (low.id === high.id) low = STATS[Math.floor(Math.random() * 12)];

    let surv = 1.0, prot = 1.0, plea = 1.0;
    
    if (high.domain === 'Survival') surv += 0.5;
    if (high.domain === 'Protection') prot += 0.5;
    if (high.domain === 'Pleasure') plea += 0.5;

    if (low.domain === 'Survival') surv -= 0.5;
    if (low.domain === 'Protection') prot -= 0.5;
    if (low.domain === 'Pleasure') plea -= 0.5;

    // Floor them so they don't hit 0 completely (0.1 min)
    surv = Math.max(0.1, surv);
    prot = Math.max(0.1, prot);
    plea = Math.max(0.1, plea);

    const title = TITLES[domain][tierIndex];
    const name = `${title} ${Math.floor(Math.random() * 900) + 100}`;
    const trait_name = `${high.name}ful but lacking ${low.name}`;

    return [burgId, name, domain, title, high.name, low.name, trait_name, surv, prot, plea];
}

async function run() {
    const c = new Client('postgres://postgres:krazy@127.0.0.1:5432/postgres');
    await c.connect();

    await c.query(`DROP TABLE IF EXISTS sim_paragons CASCADE`);
    await c.query(`
        CREATE TABLE sim_paragons (
            id SERIAL PRIMARY KEY,
            burg_id INT,
            name VARCHAR(100),
            domain VARCHAR(50),
            title VARCHAR(50),
            high_stat VARCHAR(50),
            low_stat VARCHAR(50),
            trait_name VARCHAR(100),
            survival_mult FLOAT,
            protection_mult FLOAT,
            pleasure_mult FLOAT
        )
    `);

    const burgs = await c.query("SELECT burg_id, pop_null FROM sim_burg_economy");
    let count = 0;
    
    for (const b of burgs.rows) {
        let pop = b.pop_null || 0;
        let tier = Math.floor(pop / 120);
        if (tier < 1) tier = 1;
        if (tier > 4) tier = 4;

        for (let i = 0; i < tier; i++) {
            const pCivil = generateParagon(b.burg_id, 'Civil', i);
            const pSec = generateParagon(b.burg_id, 'Security', i);
            const pSoc = generateParagon(b.burg_id, 'Social', i);

            await c.query(`INSERT INTO sim_paragons (burg_id, name, domain, title, high_stat, low_stat, trait_name, survival_mult, protection_mult, pleasure_mult) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, pCivil);
            await c.query(`INSERT INTO sim_paragons (burg_id, name, domain, title, high_stat, low_stat, trait_name, survival_mult, protection_mult, pleasure_mult) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, pSec);
            await c.query(`INSERT INTO sim_paragons (burg_id, name, domain, title, high_stat, low_stat, trait_name, survival_mult, protection_mult, pleasure_mult) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, pSoc);
            count += 3;
        }
    }

    console.log(`Generated ${count} Paragons across all Burgs.`);
    await c.end();
}
run();

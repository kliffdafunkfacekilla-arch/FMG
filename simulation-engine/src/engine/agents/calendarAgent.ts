export async function runCalendarAgent(client: any, tick: number) {
    const year = Math.floor(tick / (8 * 48)) + 1;
    const dayOfYear = tick % (8 * 48);
    const month = Math.floor(dayOfYear / 48) + 1;
    const dayOfMonth = (dayOfYear % 48) + 1;

    const SEASONS = ['The Bloom', 'The High Sun', 'The Harvest', 'The Withering', 'The Deep Cold', 'The Thaw', 'The Awakening', 'The Roaring'];
    const season = SEASONS[(month - 1) % 8] || 'The Bloom';

    let cruorbusPhase = 'The Empty Eye';
    if (dayOfMonth > 0 && dayOfMonth <= 15) cruorbusPhase = 'The Waxing Blood';
    if (dayOfMonth > 15 && dayOfMonth <= 30) cruorbusPhase = 'The Mercy Alignment';
    else if (dayOfMonth > 30) cruorbusPhase = 'The Nightmare Alignment';

    const calRes = await client.query('SELECT id FROM sim_calendar LIMIT 1');
    if (calRes.rows.length > 0) {
        await client.query('UPDATE sim_calendar SET tick = $1, month = $2, year = $3, season = $4, moon_phase = $5 WHERE id = $6', 
            [tick, month, year, season, cruorbusPhase, calRes.rows[0].id]);
    } else {
        await client.query('INSERT INTO sim_calendar (tick, year, month, moon_phase, season) VALUES ($1, $2, $3, $4, $5)', 
            [tick, year, month, cruorbusPhase, season]);
    }

    return { tick, year, month, dayOfMonth, season, cruorbusPhase };
}

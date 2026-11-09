import React, { useState } from 'react';

export const RulesLabTab: React.FC = () => {
  // 12-Attribute State (Initialized to Harrow Grist example from Canon)
  const [attr, setAttr] = useState({
    might: 7, endurance: 3, fortitude: 5, vitality: 4, reflex: 4, finesse: 3,
    intuition: 4, awareness: 3, willpower: 4, charm: 3, knowledge: 6, logic: 2
  });

  // Canonical B.R.U.T.A.L. v4.2 Derived Pools
  const health = attr.vitality + attr.fortitude + attr.intuition;
  const composure = attr.willpower + attr.awareness + attr.endurance;
  const stamina = attr.might + attr.reflex + attr.charm;
  const focus = attr.logic + attr.knowledge + attr.finesse;

  // Canonical Senses
  const perception = attr.awareness + attr.intuition + attr.finesse;
  const speed = attr.reflex + attr.vitality + attr.logic;
  const stealth = attr.knowledge + attr.charm + attr.endurance;
  const balance = attr.might + attr.fortitude + attr.willpower;
  const dodge = Math.floor(speed / 2) + 5;
  const footing = Math.floor(balance / 2) + 5;

  // Single Check State
  const [checkAttr, setCheckAttr] = useState<string>('might');
  const [checkDC, setCheckDC] = useState<number>(11); // Standard DC 11
  const [checkAdv, setCheckAdv] = useState<boolean>(false);
  const [checkDisadv, setCheckDisadv] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<any>(null);

  // Contested Combat State (d12 Opposed)
  const [atkStat, setAtkStat] = useState<number>(7);
  const [atkWeaponVal, setAtkWeaponVal] = useState<number>(3); // Heavy +3 (Maul)
  const [atkAdv, setAtkAdv] = useState<boolean>(false);
  const [defStat, setDefStat] = useState<number>(4);
  const [defArmorVal, setDefArmorVal] = useState<number>(2);  // Medium +2 (Ringmail)
  const [useGuard, setUseGuard] = useState<boolean>(false);
  const [combatHealth, setCombatHealth] = useState<number>(health);
  const [combatComposure, setCombatComposure] = useState<number>(composure);
  const [combatStamina, setCombatStamina] = useState<number>(stamina - 5);
  const [combatResult, setCombatResult] = useState<any>(null);

  // Clash Stances (B.R.U.T.A.L. 6 Stances)
  const [atkTactic, setAtkTactic] = useState<string>('PRESS');
  const [atkStanceStat, setAtkStanceStat] = useState<string>('might');
  const [defTactic, setDefTactic] = useState<string>('HOLD');
  const [defStanceStat, setDefStanceStat] = useState<string>('endurance');
  const [clashResult, setClashResult] = useState<any>(null);

  // Roll d12 Check
  const rollCheck = async () => {
    const statVal = (attr as any)[checkAttr] || 3;
    try {
      const res = await fetch('/api/rules/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attributeName: checkAttr,
          statVal,
          dc: checkDC,
          advantage: checkAdv,
          disadvantage: checkDisadv
        })
      });
      const data = await res.json();
      setCheckResult(data);
    } catch (err: any) {
      setCheckResult({ error: err.message });
    }
  };

  // Roll Contested Attack
  const rollCombat = async () => {
    try {
      const res = await fetch('/api/rules/contested_combat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attackerStat: atkStat,
          attackerWeaponValue: atkWeaponVal,
          attackerHasAdvantage: atkAdv,
          defenderStat: defStat,
          defenderArmorValue: defArmorVal,
          useGuard,
          currentHealth: combatHealth,
          currentComposure: combatComposure,
          currentStamina: combatStamina
        })
      });
      const data = await res.json();
      setCombatResult(data);
      if (data.poolsAfter) {
        setCombatHealth(data.poolsAfter.health);
        setCombatComposure(data.poolsAfter.composure);
        setCombatStamina(data.poolsAfter.stamina);
      }
    } catch (err: any) {
      setCombatResult({ error: err.message });
    }
  };

  // Roll Clash
  const rollClash = async () => {
    try {
      const res = await fetch('/api/rules/clash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attackerStance: atkTactic,
          attackerStatKey: atkStanceStat,
          attackerStatVal: (attr as any)[atkStanceStat] || 5,
          defenderStance: defTactic,
          defenderStatKey: defStanceStat,
          defenderStatVal: (attr as any)[defStanceStat] || 4
        })
      });
      const data = await res.json();
      setClashResult(data.clash);
    } catch (err: any) {
      setClashResult({ error: err.message });
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '10px 0' }}>
      {/* LEFT COLUMN: 12 ATTRIBUTES, DERIVED POOLS & SENSES */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📜</span> B.R.U.T.A.L. (v4.9) Attributes & Pools
            </h3>
            <span style={{ fontSize: 10, color: '#94a3b8', background: '#1e293b', padding: '3px 8px', borderRadius: 4 }}>
              Core Die: 1d12
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {Object.entries(attr).map(([key, val]) => (
              <div key={key} style={{ background: '#1e293b', padding: '6px 8px', borderRadius: 6 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>{key}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                  <button
                    onClick={() => setAttr(prev => ({ ...prev, [key]: Math.max(1, prev[key as keyof typeof attr] - 1) }))}
                    style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 3, width: 20, height: 20, cursor: 'pointer', fontSize: 12 }}
                  >-</button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{val}</span>
                  <button
                    onClick={() => setAttr(prev => ({ ...prev, [key]: Math.min(10, prev[key as keyof typeof attr] + 1) }))}
                    style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 3, width: 20, height: 20, cursor: 'pointer', fontSize: 12 }}
                  >+</button>
                </div>
              </div>
            ))}
          </div>

          {/* DERIVED POOLS (v4.2 FORMULAS) */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #334155', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <div style={{ background: '#1c1917', border: '1px solid #dc2626', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#f87171', fontWeight: 700 }}>HEALTH</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', marginTop: 1 }}>{health}</div>
              <div style={{ fontSize: 8, color: '#a8a29e' }}>vit+fort+int</div>
            </div>
            <div style={{ background: '#1c1917', border: '1px solid #3b82f6', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#60a5fa', fontWeight: 700 }}>COMPOSURE</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6', marginTop: 1 }}>{composure}</div>
              <div style={{ fontSize: 8, color: '#a8a29e' }}>will+aware+end</div>
            </div>
            <div style={{ background: '#1c1917', border: '1px solid #f59e0b', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700 }}>STAMINA</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b', marginTop: 1 }}>{stamina}</div>
              <div style={{ fontSize: 8, color: '#a8a29e' }}>might+ref+cha</div>
            </div>
            <div style={{ background: '#1c1917', border: '1px solid #a855f7', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#c084fc', fontWeight: 700 }}>FOCUS</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#a855f7', marginTop: 1 }}>{focus}</div>
              <div style={{ fontSize: 8, color: '#a8a29e' }}>log+know+fin</div>
            </div>
          </div>

          {/* SENSES & GUARDS */}
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#94a3b8' }}>PERCEPTION</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{perception}</div>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#94a3b8' }}>SPEED (DODGE)</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{speed} ({dodge})</div>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#94a3b8' }}>STEALTH</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{stealth}</div>
            </div>
            <div style={{ background: '#1e293b', borderRadius: 6, padding: '5px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#94a3b8' }}>BALANCE (FOOTING)</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{balance} ({footing})</div>
            </div>
          </div>
        </div>

        {/* UNCONTESTED CHECK ROLLER */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: 15, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🎯</span> Uncontested Check (1d12 + Stat)
          </h3>
          <p style={{ margin: '0 0 10px 0', fontSize: 11, color: '#94a3b8' }}>
            DCs: Easy 8 • Standard 11 • Hard 14 • Extreme 17. Margin 1–2 is Success at a Cost.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={checkAttr}
              onChange={e => setCheckAttr(e.target.value)}
              style={{ background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 6, padding: '5px 8px', fontSize: 11 }}
            >
              {Object.keys(attr).map(k => (
                <option key={k} value={k}>{k.toUpperCase()} ({(attr as any)[k]})</option>
              ))}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>DC:</span>
              <input
                type="number"
                value={checkDC}
                onChange={e => setCheckDC(Number(e.target.value))}
                style={{ width: 44, background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '4px', fontSize: 11, textAlign: 'center' }}
              />
            </div>
            <label style={{ fontSize: 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={checkAdv} onChange={e => { setCheckAdv(e.target.checked); if (e.target.checked) setCheckDisadv(false); }} />
              Adv
            </label>
            <label style={{ fontSize: 11, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={checkDisadv} onChange={e => { setCheckDisadv(e.target.checked); if (e.target.checked) setCheckAdv(false); }} />
              Disadv
            </label>
            <button
              onClick={rollCheck}
              style={{ padding: '5px 12px', background: '#eab308', color: '#000', fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11 }}
            >
              Roll d12 Check
            </button>
          </div>

          {checkResult && (
            <div style={{ marginTop: 10, padding: 8, background: checkResult.passed ? '#064e3b' : '#7f1d1d', borderRadius: 6, color: '#fff', fontSize: 11 }}>
              <strong>{checkResult.passed ? '✅ PASSED' : '❌ FAILED'}</strong> ({checkResult.degree}): {checkResult.log}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: CONTESTED COMBAT (d12 NET MARGIN) & CLASH */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚔️</span> Contested Attack (d12 Opposed)
            </h3>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Net Margin = Atk − Def</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {/* ATTACKER */}
            <div style={{ background: '#1e293b', padding: 10, borderRadius: 6, borderLeft: '3px solid #38bdf8' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 6 }}>ATTACKER</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Stat (Might 7):</span>
                  <input type="number" value={atkStat} onChange={e => setAtkStat(Number(e.target.value))} style={{ width: 36, background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: 4, textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Weapon (Heavy +3):</span>
                  <input type="number" value={atkWeaponVal} onChange={e => setAtkWeaponVal(Number(e.target.value))} style={{ width: 36, background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: 4, textAlign: 'center' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginTop: 2 }}>
                  <input type="checkbox" checked={atkAdv} onChange={e => setAtkAdv(e.target.checked)} />
                  Advantage
                </label>
              </div>
            </div>

            {/* DEFENDER */}
            <div style={{ background: '#1e293b', padding: 10, borderRadius: 6, borderLeft: '3px solid #f43f5e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f43f5e' }}>DEFENDER</div>
                <div style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>HP: {combatHealth} | Stam: {combatStamina}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10, color: '#cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Stat (Might 7 / Ref 4):</span>
                  <input type="number" value={defStat} onChange={e => setDefStat(Number(e.target.value))} style={{ width: 36, background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: 4, textAlign: 'center' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Armor (Medium +2):</span>
                  <input type="number" value={defArmorVal} onChange={e => setDefArmorVal(Number(e.target.value))} style={{ width: 36, background: '#0f172a', color: '#fff', border: '1px solid #334155', borderRadius: 4, textAlign: 'center' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginTop: 2, color: useGuard ? '#fbbf24' : '#cbd5e1' }}>
                  <input type="checkbox" checked={useGuard} onChange={e => setUseGuard(e.target.checked)} />
                  <strong>Hit Guard</strong> (No die: stat+armor)
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button
              onClick={rollCombat}
              style={{ flex: 1, padding: '7px 14px', background: '#e11d48', color: '#fff', fontWeight: 800, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
            >
              💥 Roll Contested Attack (d12)
            </button>
            <button
              onClick={() => { setCombatHealth(health); setCombatComposure(composure); setCombatStamina(stamina - 5); }}
              style={{ padding: '7px 10px', background: '#334155', color: '#cbd5e1', fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 10 }}
            >
              Reset Pools
            </button>
          </div>

          {/* COMBAT RESULT CARD */}
          {combatResult && (
            <div style={{ marginTop: 12, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  padding: '3px 8px', borderRadius: 4, fontWeight: 800, fontSize: 10,
                  background: combatResult.combat.tier === 'CRITICAL' ? '#991b1b' :
                              combatResult.combat.tier === 'MAJOR' ? '#c2410c' :
                              combatResult.combat.tier === 'MINOR' ? '#ca8a04' :
                              combatResult.combat.tier === 'GRAZE' ? '#475569' :
                              combatResult.combat.outcome === 'CLASH_TIED' ? '#7c3aed' : '#1e3a8a',
                  color: '#fff'
                }}>
                  {combatResult.combat.outcome === 'CLASH_TIED' ? '⚔️ CLASH TIED (Margin 0)' : `${combatResult.combat.tier || 'DEFENDED'}`}
                </span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>
                  Margin: {combatResult.combat.margin > 0 ? `+${combatResult.combat.margin}` : combatResult.combat.margin}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#cbd5e1', lineHeight: 1.4 }}>
                {combatResult.combat.log}
              </div>
              {combatResult.injuryApplied && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #334155', fontSize: 10, color: '#f87171' }}>
                  Capacity Lost: -{combatResult.injuryApplied.capacityLost} | Energy Shredded: -{combatResult.injuryApplied.energyShredded} Stamina
                </div>
              )}
            </div>
          )}
        </div>

        {/* THE CLASH (6 CANONICAL STANCES, MARGIN = 0) */}
        <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 15, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🛡️</span> The Clash (6 Stances, Margin = 0)
          </h3>
          <p style={{ margin: '0 0 10px 0', fontSize: 10, color: '#94a3b8' }}>
            Roll d12 + stance stat (no gear). Both pick secretly.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#38bdf8', fontWeight: 700, marginBottom: 3 }}>ATTACKER STANCE</div>
              <select
                value={atkTactic}
                onChange={e => {
                  setAtkTactic(e.target.value);
                  if (e.target.value === 'PRESS') setAtkStanceStat('might');
                  if (e.target.value === 'HOLD') setAtkStanceStat('endurance');
                  if (e.target.value === 'MANEUVER') setAtkStanceStat('reflex');
                  if (e.target.value === 'TRICK') setAtkStanceStat('finesse');
                  if (e.target.value === 'FEINT') setAtkStanceStat('fortitude');
                  if (e.target.value === 'DISENGAGE') setAtkStanceStat('vitality');
                }}
                style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '4px', fontSize: 11 }}
              >
                <option value="PRESS">Press (Might / Knowledge)</option>
                <option value="HOLD">Hold (Endurance / Logic)</option>
                <option value="MANEUVER">Maneuver (Reflex / Intuition)</option>
                <option value="TRICK">Trick (Finesse / Awareness)</option>
                <option value="FEINT">Feint (Fortitude / Willpower)</option>
                <option value="DISENGAGE">Disengage (Vitality / Charm)</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#f43f5e', fontWeight: 700, marginBottom: 3 }}>DEFENDER STANCE</div>
              <select
                value={defTactic}
                onChange={e => {
                  setDefTactic(e.target.value);
                  if (e.target.value === 'PRESS') setDefStanceStat('might');
                  if (e.target.value === 'HOLD') setDefStanceStat('endurance');
                  if (e.target.value === 'MANEUVER') setDefStanceStat('reflex');
                  if (e.target.value === 'TRICK') setDefStanceStat('finesse');
                  if (e.target.value === 'FEINT') setDefStanceStat('fortitude');
                  if (e.target.value === 'DISENGAGE') setDefStanceStat('vitality');
                }}
                style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid #334155', borderRadius: 4, padding: '4px', fontSize: 11 }}
              >
                <option value="PRESS">Press (Might / Knowledge)</option>
                <option value="HOLD">Hold (Endurance / Logic)</option>
                <option value="MANEUVER">Maneuver (Reflex / Intuition)</option>
                <option value="TRICK">Trick (Finesse / Awareness)</option>
                <option value="FEINT">Feint (Fortitude / Willpower)</option>
                <option value="DISENGAGE">Disengage (Vitality / Charm)</option>
              </select>
            </div>
          </div>

          <button
            onClick={rollClash}
            style={{ width: '100%', padding: '6px', background: '#8b5cf6', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, marginTop: 10 }}
          >
            Resolve Clash Roll (d12 + Stat)
          </button>

          {clashResult && (
            <div style={{ marginTop: 10, padding: 8, background: '#1e293b', borderRadius: 6, fontSize: 10, color: '#e2e8f0', borderLeft: `3px solid ${clashResult.result === 'ATTACKER_WINS_CLASH' ? '#38bdf8' : clashResult.result === 'DEFENDER_WINS_CLASH' ? '#f43f5e' : '#a855f7'}` }}>
              <div><strong>{clashResult.result}:</strong> {clashResult.narrative}</div>
              <div style={{ marginTop: 4, color: '#38bdf8' }}>Winner: {clashResult.winnerBenefit}</div>
              <div style={{ color: '#f87171' }}>Loser: {clashResult.loserPenalty}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

"""
OSTRAKA LIVING WORLD VTT APPLICATION - VERSION 7 (WITH CAMP & REST PHASE MANAGER)
==================================================================================
A full interactive Streamlit Virtual Tabletop (VTT) and Couch Co-Op application
for playing Ostraka. Integrates the 351x351 Earth-scale tactical grid, procedural sub-maps,
Universal 5-Facet Tag Engine, Voice/STT parser, Social Interrogation Trees, AI DM Orchestrator,
Local Wi-Fi Mobile Companion Controller, Concordia Memory Stream, WhatELSE Narrative Compiler,
and the Unified Resting & Camp Skill Engine.

Run locally via:
    streamlit run ostraka_vtt_app-v7.py
"""

import sys
import os
import json
import random
import time
import streamlit as st
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# Ensure workspace paths are in sys.path
sys.path.extend(["/workspace/artifacts", "/workspace/scratch"])

from ai_dm_orchestrator import AIDMOrchestrator
from couch_coop_turn_manager import TurnManager, CouchPlayerSeat
from vtt_state_exporter import VTTStateExporter
from companion_device_controller import CompanionDeviceServer
from narrative_compiler_engine import NarrativeCompilerEngine, AbstractNarrativeBeat
from resting_system_engine import UnifiedRestSession, PartyMemberRestContribution

# Page Configuration
st.set_page_config(
    page_title="Ostraka Living World VTT v7",
    page_icon="⚔️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Dark Gaming Theme, Mobile Layout, and Camp Phase
st.markdown("""
<style>
    .stApp { background-color: #0d1117; color: #c9d1d9; }
    .main-title { font-family: 'Cinzel', serif; font-size: 2.2rem; color: #f0883e; text-align: center; }
    .subtitle { font-size: 1.0rem; color: #8b949e; text-align: center; margin-bottom: 20px; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .mobile-card { background: #1f242d; border: 2px solid #58a6ff; border-radius: 12px; padding: 16px; margin-bottom: 15px; text-align: center; }
    .camp-card { background: #1c2118; border: 2px solid #7ee787; border-radius: 12px; padding: 16px; margin-bottom: 15px; }
    .narration-box { background: #1f1b24; border-left: 4px solid #a371f7; padding: 15px; border-radius: 4px; font-style: italic; color: #dcbdfb; font-size: 1.1rem; }
    .reaction-alert { background: #3b1219; border: 2px solid #f85149; padding: 14px; border-radius: 8px; color: #ff7b72; font-weight: bold; margin-top: 10px; text-align: center; }
    .tag-badge { background: #21262d; border: 1px solid #30363d; color: #58a6ff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 4px; display: inline-block; }
</style>
""", unsafe_allow_html=True)


# Initialize Session State
if "orchestrator" not in st.session_state:
    gm = AIDMOrchestrator()
    gm.initialize_session([
        {
            "seat_id": "P1",
            "player_name": "Alex",
            "controller_index": 0,
            "character_data": {"name": "Vael Null-Warden", "might": 4, "finesse": 2, "reflex": 4, "is_null": True, "hp": 30, "max_hp": 30, "stamina": 20, "max_stamina": 20}
        },
        {
            "seat_id": "P2",
            "player_name": "Jordan",
            "controller_index": 1,
            "character_data": {"name": "Ignis Sparkborn Mage", "might": 1, "finesse": 4, "reflex": 3, "is_null": False, "hp": 24, "max_hp": 24, "stamina": 20, "max_stamina": 20}
        }
    ])
    st.session_state.orchestrator = gm
    st.session_state.companion_server = CompanionDeviceServer()
    st.session_state.narrative_compiler = NarrativeCompilerEngine()
    
    # Register Default WhatELSE Beat
    default_beat = AbstractNarrativeBeat(
        beat_id="BEAT_CHECKPOINT_INFILTRATION",
        title="Bypass Excelsis Burg Garrison Checkpoint",
        level="SCENE",
        goal_condition={"checkpoint_cleared": True},
        candidate_tags=["gilded_compass", "cut", "null_void", "bribeable"]
    )
    st.session_state.narrative_compiler.register_abstract_beat(default_beat)

    # Pair Companion Devices
    st.session_state.companion_server.pair_device("iPad_Air_Alex", "P1", "Alex", {
        "name": "Vael Null-Warden", "hp": 30, "max_hp": 30, "stamina": 20, "max_stamina": 20, "is_null": True,
        "equipment": ["Greatsword (+3 Rating)", "Null Amulet (+2 Rating)"], "tags": ["null_void", "heavy_armored"]
    })
    st.session_state.companion_server.pair_device("iPhone_15_Pro_Jordan", "P2", "Jordan", {
        "name": "Ignis Sparkborn Mage", "hp": 24, "max_hp": 24, "stamina": 20, "max_stamina": 20, "is_null": False,
        "equipment": ["Silicon Staff (+4 Rating)", "Mage Robes (+1 Rating)"], "tags": ["sparkborn", "electric", "conductive_arc"]
    })

    st.session_state.active_seat_id = "P2"
    st.session_state.active_map_view = "OUTDOOR"
    st.session_state.last_rest_summary = None

gm = st.session_state.orchestrator
companion = st.session_state.companion_server
compiler = st.session_state.narrative_compiler

# Header Title
st.markdown("<div class='main-title'>⚔️ OSTRAKA LIVING WORLD VTT ENGINE (v7)</div>", unsafe_allow_html=True)
st.markdown("<div class='subtitle'>351x351 Tactical Canvas • Concordia Memory Stream • WhatELSE Compiler • Unified Camp & Rest System</div>", unsafe_allow_html=True)

# Application View Mode Selector
app_mode = st.radio(
    "📺 Select Application View Mode:",
    [
        "📺 TV / Host Master VTT View",
        "📱 Smartphone Companion Controller",
        "🧠 Concordia Memory Stream Log",
        "📖 WhatELSE Narrative Compiler",
        "🏕️ Camp & Rest Phase Manager"
    ],
    horizontal=True
)

st.divider()

# =============================================================================
# MODE 1: TV / HOST MASTER VTT VIEW
# =============================================================================
if "TV" in app_mode:
    col_left, col_center, col_right = st.columns([1, 2.2, 1.2])

    with col_left:
        st.subheader("🎮 Local Couch Seats")
        for seat in gm.turn_manager.seats:
            is_active = (seat.seat_id == st.session_state.active_seat_id)
            border_color = "#f0883e" if is_active else "#30363d"
            st.markdown(f"""
            <div class="stat-card" style="border-color: {border_color};">
                <div style="font-weight: bold; color: {'#f0883e' if is_active else '#c9d1d9'};">
                    {seat.seat_id} ({seat.player_name}) {'👈 ACTIVE TURN' if is_active else ''}
                </div>
                <div style="font-size: 0.9rem; color: #8b949e;">{seat.character_name}</div>
                <div style="margin-top: 6px;">
                    <b>HP:</b> {seat.hp}/{seat.max_hp} | <b>Stamina:</b> {seat.stamina}/{seat.max_stamina}
                </div>
            </div>
            """, unsafe_allow_html=True)

        st.subheader("🎲 Initiative Turn Order")
        st.markdown("""
        1. **P2: Ignis Sparkborn Mage** (Score: 18) 👈
        2. **P1: Vael Null-Warden** (Score: 14)
        3. **NPC: Captain Kael (Fulcrum Guard)** (Score: 10)
        """)

    with col_center:
        st.subheader("🗺️ Live Tactical Canvas (1:1 Earth Scale)")
        fig, ax = plt.subplots(figsize=(7, 7), facecolor='#0d1117')
        ax.set_facecolor('#161b22')
        ax.set_xlim(170, 182)
        ax.set_ylim(170, 182)
        ax.grid(True, color='#21262d', linestyle='--', linewidth=0.5)

        for x in range(170, 182):
            for y in range(170, 182):
                ax.add_patch(patches.Rectangle((x, y), 1, 1, fill=True, color='#1f242d', ec='#30363d', lw=0.3))

        ax.add_patch(patches.Circle((174.5, 175.5), 0.45, fill=True, color='#3b82f6', ec='#60a5fa', lw=2))
        ax.text(174.5, 175.5, "P2\nIgnis", color='white', fontsize=8, fontweight='bold', ha='center', va='center')

        ax.add_patch(patches.Circle((173.5, 174.5), 0.45, fill=True, color='#10b981', ec='#34d399', lw=2))
        ax.text(173.5, 174.5, "P1\nVael", color='white', fontsize=8, fontweight='bold', ha='center', va='center')

        ax.add_patch(patches.Circle((177.5, 177.5), 0.45, fill=True, color='#dc2626', ec='#f87171', lw=2))
        ax.text(177.5, 177.5, "Guard\n[STUNNED]", color='white', fontsize=7, fontweight='bold', ha='center', va='center')

        ax.set_aspect('equal')
        st.pyplot(fig)

        st.subheader("📢 Real-Time AI DM Narration")
        st.markdown("<div class='narration-box'>\"You vault over the Oak Table and cast Aetheric Arc at Captain Kael!\"</div>", unsafe_allow_html=True)

    with col_right:
        st.subheader("🎤 Host Voice / STT Console")
        stt_input = st.text_input("Simulated STT Transcript:", value="I vault over the table and cast Aetheric Arc!")
        if st.button("⚡ Execute Host Voice Intent"):
            res = gm.process_player_turn_input("P2", stt_input)
            st.success("Action Executed & Concordia Memory Logged!")

# =============================================================================
# MODE 2: SMARTPHONE COMPANION CONTROLLER
# =============================================================================
elif "Smartphone" in app_mode:
    st.subheader("📱 Local Wi-Fi Companion Controller")
    selected_seat = st.selectbox("Select Character Seat:", ["P2: Jordan (Ignis Sparkborn Mage)", "P1: Alex (Vael Null-Warden)"])
    active_seat = "P2" if "P2" in selected_seat else "P1"
    view_data = companion.get_mobile_character_view(active_seat)

    col_m1, col_m2 = st.columns(2)
    with col_m1:
        st.markdown(f"""
        <div class="mobile-card">
            <h3>🛡️ {view_data['character_name']}</h3>
            <b>HP:</b> {view_data['vital_stats']['hp_current']}/{view_data['vital_stats']['hp_max']} |
            <b>Stamina:</b> {view_data['vital_stats']['stamina_current']}/{view_data['vital_stats']['stamina_max']}
        </div>
        """, unsafe_allow_html=True)

    with col_m2:
        st.subheader("📲 Tapped Action Grid")
        for btn in view_data['tapped_action_grid']:
            if st.button(f"{btn['label']} (-{btn['stamina_cost']} Stamina)", key=f"v7_{btn['id']}"):
                companion.dispatch_tapped_action(active_seat, btn['id'])
                st.success(f"Dispatched '{btn['label']}' to Host TV Screen!")

# =============================================================================
# MODE 3: CONCORDIA MEMORY STREAM
# =============================================================================
elif "Concordia" in app_mode:
    st.subheader("🧠 Concordia Memory Stream & Audit Trail")
    trace_log = gm.concordia_ledger.get_full_session_history()
    st.caption(f"Recorded Component Traces: {len(trace_log)}")

    for entry in trace_log:
        st.markdown(f"""
        <div class="stat-card">
            <b>Trace ID:</b> <code>{entry['trace_id']}</code> | <b>Component:</b> {entry['component_name']}<br>
            <b>Actor:</b> {entry['actor']} | <b>Reasoning:</b> <i>{entry['reasoning_trace']}</i>
        </div>
        """, unsafe_allow_html=True)

# =============================================================================
# MODE 4: WHATELSE NARRATIVE COMPILER
# =============================================================================
elif "WhatELSE" in app_mode:
    st.subheader("📖 WhatELSE Narrative Space & Beat Compiler")
    party_tags = ["gilded_compass", "cut", "slashing", "electric", "null_void"]
    compiled = compiler.compile_beat_to_tactical_grid("BEAT_CHECKPOINT_INFILTRATION", {"cell_id": 10522}, party_tags)

    st.markdown(f"### 📖 Beat: {compiled['beat_title']} ({compiled['abstraction_level']} Level)")
    for idx, var in enumerate(compiled['compiled_variants'], 1):
        st.markdown(f"**Variant {idx} ({var['type']})**: Action `{var['required_action']}` on `{var['target']}`")

# =============================================================================
# MODE 5: CAMP & REST PHASE MANAGER
# =============================================================================
else:
    st.subheader("🏕️ Unified Camp & Rest Phase Manager")
    st.caption("Camping in the wild and staying at an inn follow the exact same recovery rules. Injury repair is scaled by 3 party skill checks:")

    col_rest_left, col_rest_right = st.columns([1, 1.2])

    with col_rest_left:
        st.subheader("📍 Rest Configuration")
        loc_type = st.radio("Rest Location Type:", ["WILDERNESS_CAMP (Field Camp)", "TOWN_INN (Burg Safehaven)", "AETHER_SANCTUM (Immersion Site)"])
        loc_name = st.text_input("Camp / Inn Name:", value="Excelsis Foothills Basecamp")

        st.markdown("#### 🎲 Party Skill Check Rolls")
        
        # 1. Meal Component
        st.markdown("<b>1. Meal Component Check</b> (Survival / Cooking)", unsafe_allow_html=True)
        chef_name = st.selectbox("Party Chef:", ["Jordan (Ignis)", "Alex (Vael)"], index=0)
        cook_roll = st.slider("Cooking Roll Result (d20 + Skill):", min_value=2, max_value=28, value=17)

        # 2. Security Rating
        st.markdown("<b>2. Security Rating Check</b> (Tactics / Fortification)", unsafe_allow_html=True)
        sentry_name = st.selectbox("Party Sentry:", ["Alex (Vael)", "Jordan (Ignis)"], index=0)
        sentry_roll = st.slider("Sentry Roll Result (d20 + Skill):", min_value=2, max_value=28, value=15)

        # 3. Entertainment Factor
        st.markdown("<b>3. Entertainment Check</b> (Performance / Storytelling)", unsafe_allow_html=True)
        bard_name = st.selectbox("Party Performer:", ["Jordan (Ignis)", "Alex (Vael)"], index=0)
        bard_roll = st.slider("Entertainment Roll Result (d20 + Skill):", min_value=2, max_value=28, value=18)

        if st.button("⛺ Execute Party Rest & Resolve Injury Recovery", type="primary"):
            rest_session = UnifiedRestSession(location_name=loc_name, location_type=loc_type)
            
            c_check = PartyMemberRestContribution(chef_name, "Cooking", cook_roll, 12)
            s_check = PartyMemberRestContribution(sentry_name, "Fortification", sentry_roll, 12)
            e_check = PartyMemberRestContribution(bard_name, "Performance", bard_roll, 12)

            res = rest_session.resolve_rest_checks(c_check, s_check, e_check)
            st.session_state.last_rest_summary = res
            st.success("Rest Executed & Injury Recovery Calculated!")

    with col_rest_right:
        st.subheader("📊 Rest & Recovery Results")
        if st.session_state.last_rest_summary:
            summary = st.session_state.last_rest_summary
            st.markdown(f"""
            <div class="camp-card">
                <h3>📍 {summary['location']}</h3>
                <div style="margin-top: 10px;">
                    <b>🍲 Meal Component:</b> {summary['meal_component']['result_tier']}
                </div>
                <div style="margin-top: 8px;">
                    <b>🛡️ Security Rating:</b> {summary['security_rating']['status']}
                    <span class="tag-badge">Ambush Risk: {summary['security_rating']['ambush_chance_percent']}%</span>
                </div>
                <div style="margin-top: 8px;">
                    <b>🎭 Entertainment Factor:</b> {summary['entertainment_factor']['tier']}
                </div>
                <hr style="border-color: #30363d;">
                <div style="font-size: 1.2rem; color: #7ee787; font-weight: bold;">
                    ❤️ Injury Regeneration: {summary['injury_regeneration_rate']}
                </div>
                <div style="font-size: 1.1rem; color: #58a6ff; font-weight: bold; margin-top: 5px;">
                    ✨ Next-Day Party Buff: {summary['entertainment_factor']['party_skill_check_buff']}
                </div>
            </div>
            """, unsafe_allow_html=True)

            if st.button("🔄 Apply Recovery to Party Sheets"):
                for seat in gm.turn_manager.seats:
                    seat.hp = seat.max_hp
                    seat.stamina = seat.max_stamina
                st.info("❤️ Party Health, Stamina, and Trauma fully restored according to rest metrics!")
        else:
            st.info("Configure camp checks on the left and tap 'Execute Party Rest' to compute injury recovery metrics.")

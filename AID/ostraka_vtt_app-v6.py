"""
OSTRAKA LIVING WORLD VTT APPLICATION - VERSION 6 (WITH WHATELSE NARRATIVE COMPILER)
==================================================================================
A full interactive Streamlit Virtual Tabletop (VTT) and Couch Co-Op application
for playing Ostraka. Integrates the 351x351 Earth-scale tactical grid, procedural sub-maps,
Universal 5-Facet Tag Engine, Voice/STT parser, Social Interrogation Trees, AI DM Orchestrator,
Local Wi-Fi Mobile Companion Controller, Concordia Memory Stream, and WhatELSE Narrative Compiler.

Run locally via:
    streamlit run ostraka_vtt_app-v6.py
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
from PIL import Image

# Ensure workspace paths are in sys.path
sys.path.extend(["/workspace/artifacts", "/workspace/scratch"])

from ai_dm_orchestrator import AIDMOrchestrator
from couch_coop_turn_manager import TurnManager, CouchPlayerSeat
from vtt_state_exporter import VTTStateExporter
from procedural_submap_engine import SubMapFormula
from companion_device_controller import CompanionDeviceServer
from narrative_compiler_engine import NarrativeCompilerEngine, AbstractNarrativeBeat

# Page Configuration
st.set_page_config(
    page_title="Ostraka Living World VTT v6",
    page_icon="⚔️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Dark Gaming Theme and Mobile Touch Layout
st.markdown("""
<style>
    .stApp { background-color: #0d1117; color: #c9d1d9; }
    .main-title { font-family: 'Cinzel', serif; font-size: 2.2rem; color: #f0883e; text-align: center; }
    .subtitle { font-size: 1.0rem; color: #8b949e; text-align: center; margin-bottom: 20px; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .mobile-card { background: #1f242d; border: 2px solid #58a6ff; border-radius: 12px; padding: 16px; margin-bottom: 15px; text-align: center; }
    .narration-box { background: #1f1b24; border-left: 4px solid #a371f7; padding: 15px; border-radius: 4px; font-style: italic; color: #dcbdfb; font-size: 1.1rem; }
    .reaction-alert { background: #3b1219; border: 2px solid #f85149; padding: 14px; border-radius: 8px; color: #ff7b72; font-weight: bold; margin-top: 10px; text-align: center; }
    .tag-badge { background: #21262d; border: 1px solid #30363d; color: #58a6ff; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; margin-right: 4px; display: inline-block; }
    .variant-card { background: #161b22; border: 1px solid #388bfd; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
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
    st.session_state.stt_history = []
    st.session_state.active_map_view = "OUTDOOR"
    st.session_state.compiled_beat_data = None

gm = st.session_state.orchestrator
companion = st.session_state.companion_server

# Header Title
st.markdown("<div class='main-title'>⚔️ OSTRAKA VTT v6 - WHATELSE NARRATIVE COMPILER INTEGRATED</div>", unsafe_allow_html=True)
st.markdown("<div class='subtitle'>351x351 Tactical Canvas • Mobile Wi-Fi Controller • Concordia Memory Stream • WhatELSE Narrative Space</div>", unsafe_allow_html=True)

# Mode Selector at Top
app_mode = st.radio(
    "📺 Select Application View Mode:",
    [
        "📺 TV / Host Master VTT View (Living Room Screen)",
        "📱 Smartphone / Tablet Companion Controller (Player Handheld)",
        "🧠 Concordia Memory Stream & Audit Trail",
        "📖 WhatELSE Narrative Space & Beat Compiler"
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
        ax.set_title("Outdoor Battle Canvas (351x351 Grid Sector: X 170-182 | Y 170-182)", color='#f0883e', fontsize=11)
        ax.set_xlim(170, 182)
        ax.set_ylim(170, 182)
        ax.grid(True, color='#21262d', linestyle='--', linewidth=0.5)

        for x in range(170, 182):
            for y in range(170, 182):
                ax.add_patch(patches.Rectangle((x, y), 1, 1, fill=True, color='#1f242d', ec='#30363d', lw=0.3))

        ax.add_patch(patches.Rectangle((176, 175), 1.5, 1, fill=True, color='#8b5a2b', ec='#ffd700', lw=1.5))
        ax.text(176.75, 175.5, "Oak Table\n[MOVABLE]", color='white', fontsize=7, ha='center', va='center')

        ax.add_patch(patches.Circle((175.5, 176.5), 0.7, fill=True, color='#d97706', alpha=0.6))
        ax.add_patch(patches.Circle((175.5, 176.5), 0.4, fill=True, color='#ef4444', alpha=0.8))
        ax.text(175.5, 176.5, "Chandelier\n[COLLAPSED]", color='white', fontsize=7, ha='center', va='center')

        ax.add_patch(patches.Circle((174.5, 175.5), 0.45, fill=True, color='#3b82f6', ec='#60a5fa', lw=2))
        ax.text(174.5, 175.5, "P2\nIgnis", color='white', fontsize=8, fontweight='bold', ha='center', va='center')

        ax.add_patch(patches.Circle((173.5, 174.5), 0.45, fill=True, color='#10b981', ec='#34d399', lw=2))
        ax.text(173.5, 174.5, "P1\nVael", color='white', fontsize=8, fontweight='bold', ha='center', va='center')

        ax.add_patch(patches.Circle((177.5, 177.5), 0.45, fill=True, color='#dc2626', ec='#f87171', lw=2))
        ax.text(177.5, 177.5, "Guard\n[STUNNED]", color='white', fontsize=7, fontweight='bold', ha='center', va='center')

        ax.set_aspect('equal')
        st.pyplot(fig)

        st.subheader("📢 Real-Time AI DM Narration")
        latest_narration = "You vault over the Oak Table, sever the chandelier support, and channel an Aetheric Arc into the Guard! Lightning surges through his steel plate armor, leaving him STUNNED!"
        st.markdown(f"<div class='narration-box'>\"{latest_narration}\"</div>", unsafe_allow_html=True)

    with col_right:
        st.subheader("🎤 Host Voice / STT Console")
        stt_input = st.text_input("Simulated STT Transcript:", value="I vault over the table and cast Aetheric Arc at the Fulcrum Guard!")
        if st.button("⚡ Execute Host Voice Intent", type="primary"):
            res = gm.process_player_turn_input("P2", stt_input)
            st.success("Action Executed!")

# =============================================================================
# MODE 2: SMARTPHONE CONTROLLER
# =============================================================================
elif "Smartphone" in app_mode:
    st.subheader("📱 Local Wi-Fi Companion Controller")
    selected_seat = st.selectbox("Select Character Seat:", ["P2: Jordan (Ignis Sparkborn Mage)", "P1: Alex (Vael Null-Warden)"])
    active_seat = "P2" if "P2" in selected_seat else "P1"
    view_data = companion.get_mobile_character_view(active_seat)

    col_mob_left, col_mob_right = st.columns([1, 1])
    with col_mob_left:
        st.markdown(f"""
        <div class="mobile-card">
            <h3>🛡️ {view_data['character_name']} ({view_data['player_name']})</h3>
            <div><b>❤️ HP:</b> {view_data['vital_stats']['hp_current']}/{view_data['vital_stats']['hp_max']} | <b>⚡ Stamina:</b> {view_data['vital_stats']['stamina_current']}/{view_data['vital_stats']['stamina_max']}</div>
        </div>
        """, unsafe_allow_html=True)

    with col_mob_right:
        st.subheader("📲 Tapped Action Grid")
        for btn in view_data['tapped_action_grid']:
            if st.button(f"{btn['label']} (-{btn['stamina_cost']} Stamina)", key=f"mob2_{btn['id']}"):
                res = companion.dispatch_tapped_action(active_seat, btn['id'], target_name="Oak Dining Table")
                st.success(f"Dispatched '{btn['label']}' to TV Screen!")

# =============================================================================
# MODE 3: CONCORDIA MEMORY STREAM
# =============================================================================
elif "Concordia" in app_mode:
    st.subheader("🧠 Concordia Memory Stream & Audit Trail")
    memory_stream = gm.concordia_ledger.memory_stream

    st.metric("Total Ledger Trace Entries", len(memory_stream))

    for idx, entry in enumerate(reversed(memory_stream), 1):
        with st.expander(f"Trace #{entry['trace_id']} • {entry['component_name']} ({entry['actor']})"):
            st.json(entry)

    if st.button("📑 Export Concordia Session Log JSON"):
        path = gm.concordia_ledger.export_ledger_json()
        st.success(f"Ledger JSON saved to {path}!")

# =============================================================================
# MODE 4: WHATELSE NARRATIVE SPACE & BEAT COMPILER
# =============================================================================
else:
    st.subheader("📖 WhatELSE 3-View Narrative Space & Beat Compiler")
    st.caption("Neuro-Symbolic compilation of high-level authorial quest beats into 5ft tactical grid schemas:")

    col_w1, col_w2 = st.columns([1, 1.2])

    with col_w1:
        st.subheader("1. Outline View (Abstraction Ladder)")
        abs_level = st.select_slider("Abstraction Ladder Level:", options=["BEAT", "SCENE", "SEQUENCE", "ACT"], value="SCENE")
        beat_id_choice = st.selectbox("Select Quest Beat:", ["BEAT_CHECKPOINT_INFILTRATION"])

        party_tags = st.multiselect(
            "Active Party Tags for Precondition Evaluation:",
            ["gilded_compass", "cut", "slashing", "electric", "null_void", "official_seal", "bribeable"],
            default=["gilded_compass", "cut", "null_void"]
        )

        if st.button("⚙️ Compile Abstract Beat to 5ft Grid", type="primary"):
            with st.spinner("Running WhatELSE Interactive Narrative Compiler..."):
                compiled_res = gm.compile_active_quest_beat(beat_id_choice, party_tags)
                st.session_state.compiled_beat_data = compiled_res
                st.success("Beat Compiled into Tactical Grid Schemas!")

    with col_w2:
        st.subheader("2. Variants View (Compiled Tactical Schemas)")
        compiled = st.session_state.compiled_beat_data or gm.compile_active_quest_beat("BEAT_CHECKPOINT_INFILTRATION", ["gilded_compass", "cut", "null_void"])

        st.markdown(f"**Abstract Beat:** `{compiled['beat_title']}` ({compiled['abstraction_level']} Level)")
        st.markdown(f"**Pivot Baseline Context:** *\"{compiled['pivot_context']}\"*")

        for idx, var in enumerate(compiled['compiled_variants'], 1):
            st.markdown(f"""
            <div class="variant-card">
                <b>Variant {idx}: {var['type']}</b><br>
                • <b>Action:</b> <code>{var['required_action']}</code> ➔ <b>Target:</b> {var['target']} at Tile {var['tactical_5ft_position']}<br>
                • <b>Action Tags:</b> {', '.join([f"<code>{t}</code>" for t in var['action_tags']])}<br>
                • <b>Preconditions Met:</b> {'<span style="color:#7ee787;">YES</span>' if var['precondition_met'] else '<span style="color:#ff7b72;">NO</span>'}<br>
                • <b>Grid Effects:</b> {', '.join([e['type'] for e in var['grid_effects']])}
            </div>
            """, unsafe_allow_html=True)
            if st.button(f"🎯 Deploy Variant {idx} to 351x351 Grid", key=f"deploy_{var['variant_id']}"):
                st.success(f"Deployed '{var['required_action']}' onto tactical grid sector!")

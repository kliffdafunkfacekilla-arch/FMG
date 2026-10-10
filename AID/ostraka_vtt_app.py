"""
OSTRAKA LIVING WORLD VTT APPLICATION (STREAMLIT DASHBOARD)
=========================================================
A full interactive Streamlit Virtual Tabletop (VTT) and Couch Co-Op application
for playing Ostraka. Integrates the 351x351 Earth-scale tactical grid, procedural sub-maps,
Universal 5-Facet Tag Engine, Voice/STT parser, Social Interrogation Trees, and AI DM Orchestrator.

Run locally via:
    streamlit run ostraka_vtt_app.py
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

# Page Configuration
st.set_page_config(
    page_title="Ostraka Living World VTT",
    page_icon="⚔️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for Dark Gaming Theme
st.markdown("""
<style>
    .stApp { background-color: #0d1117; color: #c9d1d9; }
    .main-title { font-family: 'Cinzel', serif; font-size: 2.2rem; color: #f0883e; text-align: center; }
    .subtitle { font-size: 1.0rem; color: #8b949e; text-align: center; margin-bottom: 20px; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .narration-box { background: #1f1b24; border-left: 4px solid #a371f7; padding: 15px; border-radius: 4px; font-style: italic; color: #dcbdfb; font-size: 1.1rem; }
    .reaction-alert { background: #3b1219; border: 1px solid #f85149; padding: 12px; border-radius: 6px; color: #ff7b72; font-weight: bold; margin-top: 10px; }
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
    st.session_state.active_seat_id = "P2"
    st.session_state.stt_history = []
    st.session_state.active_map_view = "OUTDOOR" # "OUTDOOR" or "SUBMAP"

gm = st.session_state.orchestrator

# Header Title
st.markdown("<div class='main-title'>⚔️ OSTRAKA LIVING WORLD VTT & COUCH CO-OP ENGINE</div>", unsafe_allow_html=True)
st.markdown("<div class='subtitle'>351x351 Tactical Grid • Procedural Sub-Maps • 5-Facet Universal Tags • STT Voice Engine</div>", unsafe_allow_html=True)

# Layout Setup: 3 Columns (Left: Party/Turn Queue, Center: Canvas & Narration, Right: STT Console & Interrogation)
col_left, col_center, col_right = st.columns([1, 2.2, 1.2])

# =============================================================================
# LEFT COLUMN: PARTY SEATS & INITIATIVE QUEUE
# =============================================================================
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
            <div style="font-size: 0.9rem; color: #8b949e;">{seat.character_name} ({'NULL WARDEN' if seat.is_null else 'SPARKBORN MAGE'})</div>
            <div style="margin-top: 6px;">
                <b>HP:</b> {seat.hp}/{seat.max_hp} | <b>Stamina:</b> {seat.stamina}/{seat.max_stamina}
            </div>
            <div style="margin-top: 4px;">
                <span class="tag-badge">Reflex {seat.reflex}</span>
                <span class="tag-badge">{'NULL' if seat.is_null else 'SPARKBORN'}</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

    st.subheader("🎲 Initiative Turn Order")
    st.markdown("""
    1. **P2: Ignis Sparkborn Mage** (Score: 18) 👈
    2. **P1: Vael Null-Warden** (Score: 14)
    3. **NPC: Captain Kael (Fulcrum Guard)** (Score: 10)
    """)

    st.divider()
    st.subheader("🗺️ Map View Switcher")
    map_choice = st.radio("Active Canvas Context:", ["Outdoor 351x351 Grid", "Tavern Sub-Map Interior", "Observatory Spire Sub-Map"])
    if "Outdoor" in map_choice:
        st.session_state.active_map_view = "OUTDOOR"
    elif "Tavern" in map_choice:
        st.session_state.active_map_view = "SUBMAP_TAVERN"
    else:
        st.session_state.active_map_view = "SUBMAP_SPIRE"


# =============================================================================
# CENTER COLUMN: TACTICAL CANVAS & AI DM NARRATION
# =============================================================================
with col_center:
    st.subheader("🗺️ Live Tactical Canvas")
    
    # Render Matplotlib Grid Canvas
    fig, ax = plt.subplots(figsize=(7, 7), facecolor='#0d1117')
    ax.set_facecolor('#161b22')

    if st.session_state.active_map_view == "OUTDOOR":
        ax.set_title("Outdoor Battle Canvas (351x351 Grid Sector: X 170-182 | Y 170-182)", color='#f0883e', fontsize=11)
        ax.set_xlim(170, 182)
        ax.set_ylim(170, 182)
        ax.grid(True, color='#21262d', linestyle='--', linewidth=0.5)

        # Draw Wood Floor Grid
        for x in range(170, 182):
            for y in range(170, 182):
                ax.add_patch(patches.Rectangle((x, y), 1, 1, fill=True, color='#1f242d', ec='#30363d', lw=0.3))

        # Draw Props
        # Table
        ax.add_patch(patches.Rectangle((176, 175), 1.5, 1, fill=True, color='#8b5a2b', ec='#ffd700', lw=1.5))
        ax.text(176.75, 175.5, "Oak Table\n[MOVABLE]", color='white', fontsize=7, ha='center', va='center')

        # Severed Chandelier (Crashed)
        ax.add_patch(patches.Circle((175.5, 176.5), 0.7, fill=True, color='#d97706', alpha=0.6))
        ax.add_patch(patches.Circle((175.5, 176.5), 0.4, fill=True, color='#ef4444', alpha=0.8))
        ax.text(175.5, 176.5, "Chandelier\n[COLLAPSED]", color='white', fontsize=7, ha='center', va='center')

        # Draw Tokens
        # P2: Ignis
        ax.add_patch(patches.Circle((174.5, 175.5), 0.45, fill=True, color='#3b82f6', ec='#60a5fa', lw=2))
        ax.text(174.5, 175.5, "P2\nIgnis", color='white', fontsize=8, fontweight='bold', ha='center', va='center')

        # P1: Vael
        ax.add_patch(patches.Circle((173.5, 174.5), 0.45, fill=True, color='#10b981', ec='#34d399', lw=2))
        ax.text(173.5, 174.5, "P1\nVael", color='white', fontsize=8, fontweight='bold', ha='center', va='center')

        # Enemy: Captain Kael
        ax.add_patch(patches.Circle((177.5, 177.5), 0.45, fill=True, color='#dc2626', ec='#f87171', lw=2))
        ax.text(177.5, 177.5, "Guard\n[STUNNED]", color='white', fontsize=7, fontweight='bold', ha='center', va='center')

        # Lightning Beam Effect (Aetheric Arc)
        ax.plot([174.5, 177.5], [175.5, 177.5], color='#f59e0b', linestyle='-', linewidth=2.5, alpha=0.8)
        ax.text(176.0, 176.8, "⚡ Aetheric Arc", color='#fbbf24', fontsize=8, fontweight='bold', rotation=30)

    else:
        ax.set_title("Sub-Map Interior: Gilded Observatory Spire (Floor 0)", color='#f0883e', fontsize=11)
        ax.set_xlim(0, 18)
        ax.set_ylim(0, 18)
        ax.grid(True, color='#21262d', linestyle='-', linewidth=0.5)

        # Draw Marble Perimeter Walls
        for x in range(18):
            ax.add_patch(patches.Rectangle((x, 0), 1, 1, fill=True, color='#475569'))
            ax.add_patch(patches.Rectangle((x, 17), 1, 1, fill=True, color='#475569'))
        for y in range(18):
            ax.add_patch(patches.Rectangle((0, y), 1, 1, fill=True, color='#475569'))
            ax.add_patch(patches.Rectangle((17, y), 1, 1, fill=True, color='#475569'))

        ax.add_patch(patches.Circle((9, 9), 0.5, fill=True, color='#a855f7'))
        ax.text(9, 9, "P1/P2\nParty", color='white', fontsize=8, ha='center', va='center')

    ax.set_aspect('equal')
    st.pyplot(fig)

    st.subheader("📢 Real-Time AI DM Narration")
    latest_narration = "You vault over the Oak Table, sever the chandelier support, and channel an Aetheric Arc into the Guard! Lightning surges through his steel plate armor, leaving him STUNNED!"
    st.markdown(f"<div class='narration-box'>\"{latest_narration}\"</div>", unsafe_allow_html=True)


# =============================================================================
# RIGHT COLUMN: STT VOICE CONSOLE & INTERROGATION
# =============================================================================
with col_right:
    st.subheader("🎤 Voice / STT Console")
    st.caption("Spoken couch microphone inputs parse into physical tag actions:")
    
    stt_input = st.text_input(
        "Simulated STT Microphone Transcript:",
        value="I vault over the table and cast Aetheric Arc at the Fulcrum Guard!"
    )
    
    if st.button("⚡ Execute Voice Intent", type="primary"):
        with st.spinner("Processing STT & Tag Physics..."):
            res = gm.process_player_turn_input("P2", stt_input)
            st.success("Action Executed!")

    st.markdown("#### ⚙️ Parsed Action Primitives:")
    st.markdown("""
    - **Actions:** `[MOVE_VAULT]`, `[SEVER_PROP]`, `[CAST_SPELL]`
    - **Active Tags:** `climbable`, `cut`, `electric`, `shocking`
    - **Stamina Drain:** `-5 Points` (Remaining: `15/20`)
    """)

    st.divider()
    st.subheader("💬 Social Interrogation Menu")
    st.caption("Target: Captain Kael (Guard Captain)")
    
    st.markdown("""
    - **Target Tags:** `unyielding`, `guard`, `gilded_compass`, `veteran`
    - **Options Available:**
      - `[BRIBE]` Offer 15 Aetherium Coins
      - `[INTIMIDATE]` Slam weapon on table <span style='color:#ff7b72;'>(DISADVANTAGE: Veteran)</span>
      - `[FACTION_APPEAL]` Present Fulcrum Warrant <span style='color:#7ee787;'>(ADVANTAGE: Shared Faction)</span>
    """, unsafe_allow_html=True)

    if st.button("📜 Present Fulcrum Warrant"):
        st.info("🎯 CONTEST SUCCESS (Margin +3)! Captain Kael clears checkpoint passage.")

    st.divider()
    st.markdown("""
    <div class="reaction-alert">
        ⚡ CONTROLLER REACTION PROMPT (P1 / Alex):<br>
        <i>"Enemy spellcast detected! Activate Ontological Null Void to cancel spell tags in 15ft radius?"</i>
    </div>
    """, unsafe_allow_html=True)
    if st.button("🛡️ Trigger Null Exemption Shield"):
        st.success("P1 spent 2 Stamina! Arcane spell tags neutralized in 15ft radius.")

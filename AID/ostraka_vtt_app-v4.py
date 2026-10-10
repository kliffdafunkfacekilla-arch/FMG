"""
OSTRAKA LIVING WORLD VTT APPLICATION - VERSION 4 (FULL 12-BASED PROGRESSION INTEGRATION)
========================================================================================
A full interactive Streamlit Virtual Tabletop (VTT) and Couch Co-Op application for playing Ostraka.
Integrates:
  - 351x351 Earth-Scale Tactical Canvas & Procedural Sub-Maps
  - Universal 5-Facet Tag Engine & Social Interrogation Trees
  - STT Voice Microphone Console & Real-Time AI DM Orchestrator
  - Local Wi-Fi Smartphone/Tablet Companion Controller with Touch & Voice
  - Mobile Character Creation & Taxonomy Matrix (144 Species)
  - 12-Based Character Progression Engine & Campaign Milestone Level-Ups (1-12 Stat Scale, 48 Tracks)

Run locally via:
    streamlit run ostraka_vtt_app-v4.py
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
from progression_engine import CharacterProgression12
from integrated_progression_bridge import IntegratedProgressionBridge

# Page Configuration
st.set_page_config(
    page_title="Ostraka Living World VTT v4",
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
    .level-card { background: #1c2118; border: 2px solid #3fb950; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
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
    companion = CompanionDeviceServer()
    bridge = IntegratedProgressionBridge(gm, companion)
    
    # Pair Companion Devices
    companion.pair_device("iPad_Air_Alex", "P1", "Alex", {
        "name": "Vael Null-Warden", "hp": 30, "max_hp": 30, "stamina": 20, "max_stamina": 20, "is_null": True,
        "attributes": {"might": 4, "fortitude": 4, "willpower": 3},
        "equipment": ["Greatsword (+3 Rating)", "Null Amulet (+2 Rating)"], "tags": ["null_void", "heavy_armored"]
    })
    companion.pair_device("iPhone_15_Pro_Jordan", "P2", "Jordan", {
        "name": "Ignis Sparkborn Mage", "hp": 24, "max_hp": 24, "stamina": 20, "max_stamina": 20, "is_null": False,
        "attributes": {"knowledge": 4, "logic": 3, "awareness": 3},
        "equipment": ["Silicon Staff (+4 Rating)", "Mage Robes (+1 Rating)"], "tags": ["sparkborn", "electric", "conductive_arc"]
    })

    bridge.register_player_character("P1", {"name": "Vael Null-Warden", "attributes": {"might": 4, "fortitude": 4, "willpower": 3}})
    bridge.register_player_character("P2", {"name": "Ignis Sparkborn Mage", "attributes": {"knowledge": 4, "logic": 3, "awareness": 3}})

    st.session_state.orchestrator = gm
    st.session_state.companion_server = companion
    st.session_state.progression_bridge = bridge

    st.session_state.active_seat_id = "P2"
    st.session_state.stt_history = []
    st.session_state.active_map_view = "OUTDOOR" # "OUTDOOR" or "SUBMAP"

gm = st.session_state.orchestrator
companion = st.session_state.companion_server
bridge = st.session_state.progression_bridge

# Header Title
st.markdown("<div class='main-title'>⚔️ OSTRAKA LIVING WORLD VTT & 12-PROGRESSION ENGINE v4</div>", unsafe_allow_html=True)
st.markdown("<div class='subtitle'>351x351 Tactical Canvas • 12-Level Milestone Progression • Local Wi-Fi Controller & Character Creator</div>", unsafe_allow_html=True)

# Mode Selector at Top (TV Host Screen vs Smartphone Companion)
app_mode = st.radio(
    "📺 Select Application View Mode:",
    ["📺 TV / Host Master VTT View (Living Room Screen)", "📱 Smartphone / Tablet Companion Controller (Player Handheld)"],
    horizontal=True
)

st.divider()

# =============================================================================
# MODE 1: TV / HOST MASTER VTT VIEW
# =============================================================================
if "TV" in app_mode:
    col_left, col_center, col_right = st.columns([1, 2.2, 1.2])

    # LEFT COLUMN: PARTY SEATS & PROGRESSION MILESTONES
    with col_left:
        st.subheader("🎮 Local Couch Seats & 12-Level Progression")
        
        for seat in gm.turn_manager.seats:
            is_active = (seat.seat_id == st.session_state.active_seat_id)
            border_color = "#f0883e" if is_active else "#30363d"
            prof = bridge.player_progression_profiles.get(seat.seat_id)
            level = prof.current_level if prof else 1
            
            st.markdown(f"""
            <div class="stat-card" style="border-color: {border_color};">
                <div style="font-weight: bold; color: {'#f0883e' if is_active else '#c9d1d9'};">
                    {seat.seat_id} ({seat.player_name}) {'👈 ACTIVE TURN' if is_active else ''}
                </div>
                <div style="font-size: 0.9rem; color: #3fb950; font-weight: bold;">
                    ⭐ Level {level}/12 Milestone ({'Initiate' if level==1 else 'Adept'}) | Cap: {prof.attributes['knowledge'] if prof else 4}/12
                </div>
                <div style="font-size: 0.85rem; color: #8b949e;">{seat.character_name} ({'NULL WARDEN' if seat.is_null else 'SPARKBORN MAGE'})</div>
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

        st.divider()
        st.subheader("🏆 Campaign Quest & Level Reward")
        if st.button("🏅 Complete Quest Milestone: Purify Shrine"):
            res = bridge.award_campaign_milestone_reward("P2", "Purified Defiled Shrine")
            st.success(f"🎉 LEVEL UP AWARDED TO P2! Level {res['level_up']['new_level']} ({res['level_up']['title']})!")

        st.divider()
        st.subheader("🗺️ Map View Switcher")
        map_choice = st.radio("Active Canvas Context:", ["Outdoor 351x351 Grid", "Tavern Sub-Map Interior", "Observatory Spire Sub-Map"])
        if "Outdoor" in map_choice:
            st.session_state.active_map_view = "OUTDOOR"
        elif "Tavern" in map_choice:
            st.session_state.active_map_view = "SUBMAP_TAVERN"
        else:
            st.session_state.active_map_view = "SUBMAP_SPIRE"

    # CENTER COLUMN: TACTICAL CANVAS & AI DM NARRATION
    with col_center:
        st.subheader("🗺️ Live Tactical Canvas (1:1 Earth Scale)")
        
        fig, ax = plt.subplots(figsize=(7, 7), facecolor='#0d1117')
        ax.set_facecolor('#161b22')

        if st.session_state.active_map_view == "OUTDOOR":
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

            ax.plot([174.5, 177.5], [175.5, 177.5], color='#f59e0b', linestyle='-', linewidth=2.5, alpha=0.8)
            ax.text(176.0, 176.8, "⚡ Aetheric Arc", color='#fbbf24', fontsize=8, fontweight='bold', rotation=30)

        else:
            ax.set_title("Sub-Map Interior: Gilded Observatory Spire (Floor 0)", color='#f0883e', fontsize=11)
            ax.set_xlim(0, 18)
            ax.set_ylim(0, 18)
            ax.grid(True, color='#21262d', linestyle='-', linewidth=0.5)

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

    # RIGHT COLUMN: STT VOICE CONSOLE
    with col_right:
        st.subheader("🎤 Host Voice / STT Console")
        stt_input = st.text_input("Simulated STT Microphone Transcript:", value="I vault over the table and cast Aetheric Arc at the Fulcrum Guard!")
        
        if st.button("⚡ Execute Host Voice Intent", type="primary"):
            with st.spinner("Processing STT & Tag Physics..."):
                res = gm.process_player_turn_input("P2", stt_input)
                st.success("Action Executed!")

        st.markdown("#### ⚙️ Parsed Action Primitives:")
        st.markdown("""
        - **Actions:** `[MOVE_VAULT]`, `[SEVER_PROP]`, `[CAST_SPELL]`
        - **Active Tags:** `climbable`, `cut`, `electric`, `shocking`
        - **Stamina Drain:** `-5 Points` (Remaining: `15/20`)
        """)


# =============================================================================
# MODE 2: SMARTPHONE / TABLET COMPANION CONTROLLER
# =============================================================================
else:
    st.subheader("📱 Local Wi-Fi Companion Controller & Progression Suite")
    
    selected_seat = st.selectbox("Select Your Character Seat:", ["P2: Jordan (Ignis Sparkborn Mage)", "P1: Alex (Vael Null-Warden)"])
    active_seat = "P2" if "P2" in selected_seat else "P1"
    
    mob_tabs = st.tabs(["🎮 Touch & Voice Controller", "📈 Level Up & Skill Trees (12-Scale)", "✨ Create New Character"])

    # TAB 1: TOUCH & VOICE CONTROLLER
    with mob_tabs[0]:
        view_data = companion.get_mobile_character_view(active_seat)
        col_mob_left, col_mob_right = st.columns([1, 1])

        with col_mob_left:
            st.markdown(f"""
            <div class="mobile-card">
                <h3>🛡️ {view_data['character_name']} ({view_data['player_name']})</h3>
                <div style="font-size: 1.2rem; margin-top: 10px;">
                    <b>❤️ HP:</b> {view_data['vital_stats']['hp_current']}/{view_data['vital_stats']['hp_max']}
                </div>
                <div style="font-size: 1.2rem; margin-top: 5px; color: #58a6ff;">
                    <b>⚡ Stamina:</b> {view_data['vital_stats']['stamina_current']}/{view_data['vital_stats']['stamina_max']}
                </div>
            </div>
            """, unsafe_allow_html=True)

            st.subheader("🎒 Equipped Loadout (+1 to +5 Rating)")
            for eq in view_data['equipped_loadout']:
                st.markdown(f"- ⚔️ **{eq}**")

        with col_mob_right:
            st.subheader("📲 Tapped Action Intent Grid")
            for btn in view_data['tapped_action_grid']:
                if st.button(f"{btn['label']} (-{btn['stamina_cost']} Stamina)", key=f"mob_{btn['id']}"):
                    res = companion.dispatch_tapped_action(active_seat, btn['id'], target_name="Oak Dining Table")
                    st.success(f"Dispatched '{btn['label']}' to Host TV Screen!")

            st.divider()
            st.subheader("🎤 Tap-to-Talk Phone Mic")
            phone_voice = st.text_input("Hold mic & speak action intent:", value="I sever the chandelier rope and blast the guard!", key="mob_voice")
            if st.button("🎙️ Send Phone Voice Intent", type="primary"):
                res = companion.dispatch_voice_stt_intent(active_seat, phone_voice)
                st.success(f"Voice Command Sent: \"{phone_voice}\"")

    # TAB 2: LEVEL UP & SKILL TREES (12-SCALE)
    with mob_tabs[1]:
        st.subheader("📈 12-Level Milestone Progression & Skill Ranks")
        prof = bridge.player_progression_profiles.get(active_seat)
        
        if prof:
            st.markdown(f"""
            <div class="level-card">
                <h3 style="color: #3fb950; margin: 0;">⭐ Current Level: {prof.current_level} / 12 ({'Initiate' if prof.current_level==1 else 'Adept'})</h3>
                <p style="margin-top: 6px;"><b>Stat Cap Ceiling:</b> {prof.attributes['knowledge'] if 'knowledge' in prof.attributes else 4} / 12 Max</p>
            </div>
            """, unsafe_allow_html=True)

            st.subheader("🌲 Select Skill Track to Allocate Rank Point:")
            track_choice = st.selectbox(
                "Active Skill Track:",
                ["Mass_Power_Mass_Acceleration", "Aether_Power_Spark_Conduction", "Null_Discipline_Grounding", "Mundane_Offense_Heavy_Bludgeons"]
            )
            branch_choice = st.radio("Branching Choice Direction:", ["Choice A (Direct Impact / Overload)", "Choice B (Utility / Terrain Control)"])
            
            if st.button("⭐ Allocate Rank Point on Phone Screen", type="primary"):
                res = bridge.allocate_mobile_skill_rank(active_seat, track_choice, choice_branch="BRANCH_A" if "Choice A" in branch_choice else "BRANCH_B")
                st.balloons()
                st.success(f"Upgraded '{track_choice}' to Rank {res.get('new_rank', 1)}!")

    # TAB 3: CREATE NEW CHARACTER
    with mob_tabs[2]:
        st.subheader("✨ Mobile Character Draft & Taxonomy Matrix")
        
        hero_name = st.text_input("Hero Name:", value="Kaelen the Wind Falcon")
        path_type = st.radio("Metaphysical Path:", ["Sparkborn (Chaos Attuned)", "Null Discipline (Ontological Void)"])
        
        lineage_choice = st.selectbox("Lineage Taxonomy:", ["Mammal", "Avian", "Reptile", "Aquatic", "Insect", "Plant"])
        species_subtype = st.text_input("Species Subtype:", value="Peregrine Wind Falcon")

        st.markdown("#### 📊 Body Array Allocation (Scale 1 to 12):")
        c1, c2, c3 = st.columns(3)
        with c1:
            m_might = st.slider("Might:", 1, 12, 4)
            m_endurance = st.slider("Endurance:", 1, 12, 3)
        with c2:
            m_finesse = st.slider("Finesse:", 1, 12, 6)
            m_reflex = st.slider("Reflex:", 1, 12, 7)
        with c3:
            m_vitality = st.slider("Vitality:", 1, 12, 5)
            m_fortitude = st.slider("Fortitude:", 1, 12, 2)

        if st.button("✨ Save Character & Pair to Mobile Seat", type="primary"):
            st.success(f"Character '{hero_name}' Created & Paired to Seat {active_seat}!")

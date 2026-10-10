"""
OSTRAKA LIVING WORLD VTT APPLICATION - VERSION 3 (WITH MOBILE CHAR CREATOR)
==========================================================================
A full interactive Streamlit Virtual Tabletop (VTT) and Couch Co-Op application
for playing Ostraka. Integrates the 351x351 Earth-scale tactical grid, procedural sub-maps,
Universal 5-Facet Tag Engine, Voice/STT parser, Social Interrogation Trees, AI DM Orchestrator,
Local Wi-Fi Mobile Companion Controller, and Mobile Character Creator/Drafter.

Run locally via:
    streamlit run ostraka_vtt_app-v3.py
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
from companion_device_controller import CompanionDeviceServer, MobileCharacterDraft

# Page Configuration
st.set_page_config(
    page_title="Ostraka Living World VTT v3",
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
    .builder-card { background: #161b22; border: 1px solid #388bfd; border-radius: 10px; padding: 16px; margin-bottom: 15px; }
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
    st.session_state.active_map_view = "OUTDOOR" # "OUTDOOR" or "SUBMAP"

gm = st.session_state.orchestrator
companion = st.session_state.companion_server

# Header Title
st.markdown("<div class='main-title'>⚔️ OSTRAKA LIVING WORLD VTT & COMPANION ENGINE</div>", unsafe_allow_html=True)
st.markdown("<div class='subtitle'>351x351 Tactical Canvas • Procedural Sub-Maps • Smartphone Controller & Mobile Character Creator</div>", unsafe_allow_html=True)

# Mode Selector at Top (TV Host Screen vs Smartphone Companion)
app_mode = st.radio(
    "Select Application View Mode:",
    ["📺 TV / Host Master VTT View (Living Room Screen)", "📱 Smartphone / Tablet Companion Controller & Creator"],
    horizontal=True
)

st.divider()

# =============================================================================
# MODE 1: TV / HOST MASTER VTT VIEW
# =============================================================================
if "TV" in app_mode:
    col_left, col_center, col_right = st.columns([1, 2.2, 1.2])

    # LEFT COLUMN: PARTY SEATS & INITIATIVE QUEUE
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

    # CENTER COLUMN: TACTICAL CANVAS & AI DM NARRATION
    with col_center:
        st.subheader("🗺️ Live Tactical Canvas (1:1 Earth Scale)")
        
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

    # RIGHT COLUMN: STT VOICE CONSOLE & INTERROGATION
    with col_right:
        st.subheader("🎤 Host Voice / STT Console")
        st.caption("Spoken couch microphone inputs parse into physical tag actions:")
        
        stt_input = st.text_input(
            "Simulated STT Microphone Transcript:",
            value="I vault over the table and cast Aetheric Arc at the Fulcrum Guard!"
        )
        
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

        st.divider()
        st.subheader("💬 Social Interrogation Menu")
        st.caption("Target: Captain Kael (Guard Captain)")
        
        st.markdown("""
        - **Target Tags:** `unyielding`, `guard`, `gilded_compass`, `veteran`
        - **Options Available:**
          - `[BRIBE]` Offer 15 Aetherium Coins
          - `[INTIMIDATE]` Slam weapon on table <span style='color:#ff7b72;'>(DISADVANTAGE)</span>
          - `[FACTION_APPEAL]` Present Fulcrum Warrant <span style='color:#7ee787;'>(ADVANTAGE)</span>
        """, unsafe_allow_html=True)

        if st.button("📜 Present Fulcrum Warrant"):
            st.info("🎯 CONTEST SUCCESS (Margin +3)! Captain Kael clears checkpoint passage.")


# =============================================================================
# MODE 2: SMARTPHONE / TABLET COMPANION CONTROLLER & CHAR CREATOR
# =============================================================================
else:
    st.subheader("📱 Local Wi-Fi Mobile Companion View")
    
    # Sub-tab selector inside Mobile View
    mobile_tab = st.radio("Mobile Mode:", ["🎮 Live Controller & Character Sheet", "✨ Draft & Create New Character"], horizontal=True)

    if "Live Controller" in mobile_tab:
        # Seat Selection on Mobile
        selected_seat = st.selectbox("Select Your Character Seat:", ["P2: Jordan (Ignis Sparkborn Mage)", "P1: Alex (Vael Null-Warden)"])
        active_seat = "P2" if "P2" in selected_seat else "P1"
        
        view_data = companion.get_mobile_character_view(active_seat)
        
        col_mob_left, col_mob_right = st.columns([1, 1])

        # Left Column: Vitals & Equipment
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
                <div style="margin-top: 10px;">
                    <b>Metaphysical Attunement:</b> <span class="tag-badge">{view_data['vital_stats']['attunement']}</span>
                </div>
            </div>
            """, unsafe_allow_html=True)

            st.subheader("🎒 Equipped Loadout (+1 to +5 Rating)")
            for eq in view_data['equipped_loadout']:
                st.markdown(f"- ⚔️ **{eq}**")

            st.subheader("🏷️ Active Universal Tags")
            for tag in view_data['active_tags']:
                st.markdown(f"<span class='tag-badge'>{tag}</span>", unsafe_allow_html=True)

        # Right Column: Tapped Actions & Voice Mic
        with col_mob_right:
            st.subheader("📲 Tapped Action Intent Grid")
            st.caption("Tap an action button to dispatch intent directly to the TV screen:")

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

            st.divider()
            st.subheader("🚨 Real-Time Reaction Alert")
            if active_seat == "P1":
                st.markdown("""
                <div class="reaction-alert">
                    ⚡ HAPTIC ALERT: Chandelier collapsing above!<br>
                    Spend 2 Stamina to dive behind Oak Table cover?
                </div>
                """, unsafe_allow_html=True)
                col_act1, col_act2 = st.columns(2)
                with col_act1:
                    if st.button("✅ DIVE FOR COVER"):
                        companion.resolve_reaction_alert("P1", "ALERT_999", "EXECUTE_REACTION")
                        st.success("Reaction Executed! Character protected.")
                with col_act2:
                    if st.button("❌ PASS"):
                        companion.resolve_reaction_alert("P1", "ALERT_999", "PASS")
                        st.info("Reaction Passed.")
            else:
                st.info("No active reaction prompts pending for P2.")

    # -------------------------------------------------------------------------
    # MOBILE CHARACTER CREATOR & DRAFTER TAB
    # -------------------------------------------------------------------------
    else:
        st.subheader("✨ Mobile Character Creator & Drafter")
        st.caption("Build and validate a new hero on your phone screen, then assign them directly to your couch seat!")
        
        col_c1, col_c2 = st.columns([1, 1])
        
        with col_c1:
            st.markdown("#### 1. Identity & Metaphysical Path")
            hero_name = st.text_input("Hero Name:", value="Kaelen the Wind Falcon")
            path_type = st.radio("Metaphysical Path:", ["Sparkborn", "Null Discipline"], horizontal=True)
            path_stat = st.selectbox("Primary Specialization Stat (+2 Bonus):", ["knowledge", "logic", "awareness", "might", "willpower", "reflex"])
            
            st.markdown("#### 2. Lineage & Species Taxonomy")
            lineage = st.selectbox("Lineage Taxonomy:", ["Mammal", "Avian", "Reptile", "Aquatic", "Insect", "Plant"])
            species_input = st.text_input("Species Subtype:", value="Peregrine Wind Falcon")

        with col_c2:
            st.markdown("#### 3. Assign 6 Body Stat Array {7, 6, 5, 4, 3, 2}")
            b_might = st.number_input("Might:", 2, 7, 3)
            b_endurance = st.number_input("Endurance:", 2, 7, 4)
            b_finesse = st.number_input("Finesse:", 2, 7, 7)
            b_reflex = st.number_input("Reflex:", 2, 7, 6)
            b_vitality = st.number_input("Vitality:", 2, 7, 5)
            b_fortitude = st.number_input("Fortitude:", 2, 7, 2)

            st.markdown("#### 4. Assign 6 Mind Stat Array {7, 6, 5, 4, 3, 2}")
            m_knowledge = st.number_input("Knowledge:", 2, 7, 6)
            m_logic = st.number_input("Logic:", 2, 7, 5)
            m_awareness = st.number_input("Awareness:", 2, 7, 7)
            m_intuition = st.number_input("Intuition:", 2, 7, 4)
            m_charm = st.number_input("Charm:", 2, 7, 3)
            m_willpower = st.number_input("Willpower:", 2, 7, 2)

        st.divider()
        
        # Build and Validate Character Payload
        body_dict = {"might": b_might, "endurance": b_endurance, "finesse": b_finesse, "reflex": b_reflex, "vitality": b_vitality, "fortitude": b_fortitude}
        mind_dict = {"knowledge": m_knowledge, "logic": m_logic, "awareness": m_awareness, "intuition": m_intuition, "charm": m_charm, "willpower": m_willpower}
        
        created_hero = MobileCharacterDraft.create_draft_character(
            name=hero_name,
            path_type=path_type,
            lineage=lineage,
            species=species_input,
            body_stats=body_dict,
            mind_stats=mind_dict,
            primary_path_stat=path_stat
        )

        st.markdown(f"""
        <div class="builder-card">
            <h4>📊 Calculated Derived Stats Preview:</h4>
            • <b>Health Points (HP):</b> {created_hero['hp']} | <b>Base Stamina:</b> {created_hero['stamina']} | <b>Base Focus:</b> {created_hero['focus']}<br>
            • <b>Tactical Speed:</b> {created_hero['movement_ft']} ft per turn | <b>Attunement:</b> {'NULL VOID' if created_hero['is_null'] else 'SPARKBORN'}<br>
            • <b>Stat Allocation Validation:</b> <span style="color: #7ee787; font-weight: bold;">{created_hero['total_attribute_points']} Attribute Points Allocated</span>
        </div>
        """, unsafe_allow_html=True)

        assign_seat = st.selectbox("Assign Fresh Character to Couch Seat:", ["P1 (Alex)", "P2 (Jordan)"])
        target_seat_id = "P1" if "P1" in assign_seat else "P2"

        if st.button("✨ Save Character & Pair to Mobile Seat", type="primary"):
            res = companion.update_seat_character_from_mobile(target_seat_id, created_hero)
            st.success(f"Successfully created '{created_hero['name']}' and linked to Seat {target_seat_id}!")

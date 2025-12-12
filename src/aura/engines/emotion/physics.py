"""
Emotion physics simulation (Emotion FRD FR-EE-002).

27-dimensional emotional space with decay, inertia, and relationship dynamics.
"""

import math
from typing import Any

from aura.models.emotion import EmotionVector, EmotionPhysicsConfig


# Emotion relationship matrix (Emotion FRD FR-EE-004)
# Format: {emotion: {"amplifies": [(target, strength)], "suppresses": [(target, strength)]}}
EMOTION_RELATIONSHIPS: dict[str, dict[str, list[tuple[str, float]]]] = {
    # Primary emotions
    "joy": {
        "amplifies": [("interest", 0.3), ("trust", 0.2), ("curiosity", 0.3)],
        "suppresses": [("sadness", 0.4), ("fear", 0.3), ("doubt", 0.2)],
    },
    "love": {
        "amplifies": [("joy", 0.3), ("trust", 0.4), ("empathy", 0.3), ("compassion", 0.3)],
        "suppresses": [("anger", 0.3), ("fear", 0.2), ("disgust", 0.3)],
    },
    "interest": {
        "amplifies": [("curiosity", 0.4), ("fascination", 0.3), ("wonder", 0.2)],
        "suppresses": [("boredom", 0.5)],
    },
    "trust": {
        "amplifies": [("serenity", 0.2), ("certainty", 0.3)],
        "suppresses": [("fear", 0.3), ("doubt", 0.4)],
    },
    "fear": {
        "amplifies": [("doubt", 0.3), ("confusion", 0.2)],
        "suppresses": [("joy", 0.4), ("curiosity", 0.3), ("trust", 0.3)],
    },
    "sadness": {
        "amplifies": [("melancholy", 0.4), ("nostalgia", 0.3)],
        "suppresses": [("joy", 0.4), ("interest", 0.3)],
    },
    "anger": {
        "amplifies": [("disgust", 0.2)],
        "suppresses": [("love", 0.3), ("compassion", 0.3), ("serenity", 0.4)],
    },
    "surprise": {
        "amplifies": [("curiosity", 0.3), ("wonder", 0.2)],
        "suppresses": [("boredom", 0.3), ("certainty", 0.2)],
    },
    "disgust": {
        "amplifies": [("anger", 0.2)],
        "suppresses": [("love", 0.3), ("beauty", 0.3)],
    },
    # Cognitive emotions
    "curiosity": {
        "amplifies": [("interest", 0.4), ("fascination", 0.3), ("wonder", 0.4)],
        "suppresses": [("boredom", 0.5), ("certainty", 0.2)],
    },
    "confusion": {
        "amplifies": [("doubt", 0.3), ("curiosity", 0.2)],
        "suppresses": [("certainty", 0.4)],
    },
    "certainty": {
        "amplifies": [("confidence", 0.3), ("trust", 0.2)],
        "suppresses": [("doubt", 0.5), ("confusion", 0.4)],
    },
    "doubt": {
        "amplifies": [("confusion", 0.3), ("fear", 0.2)],
        "suppresses": [("certainty", 0.4), ("trust", 0.3)],
    },
    "fascination": {
        "amplifies": [("curiosity", 0.4), ("wonder", 0.3), ("awe", 0.2)],
        "suppresses": [("boredom", 0.5)],
    },
    "boredom": {
        "amplifies": [],
        "suppresses": [("interest", 0.3), ("curiosity", 0.3), ("fascination", 0.3)],
    },
    # Social emotions
    "empathy": {
        "amplifies": [("compassion", 0.4), ("love", 0.2)],
        "suppresses": [("anger", 0.2), ("disgust", 0.2)],
    },
    "compassion": {
        "amplifies": [("empathy", 0.3), ("love", 0.3)],
        "suppresses": [("anger", 0.3), ("envy", 0.2)],
    },
    "gratitude": {
        "amplifies": [("joy", 0.3), ("love", 0.2)],
        "suppresses": [("envy", 0.3), ("anger", 0.2)],
    },
    "pride": {
        "amplifies": [("joy", 0.2), ("certainty", 0.2)],
        "suppresses": [("shame", 0.4)],
    },
    "shame": {
        "amplifies": [("sadness", 0.3)],
        "suppresses": [("pride", 0.4), ("joy", 0.2)],
    },
    "envy": {
        "amplifies": [("anger", 0.2), ("sadness", 0.2)],
        "suppresses": [("gratitude", 0.3), ("compassion", 0.2)],
    },
    # Aesthetic emotions
    "awe": {
        "amplifies": [("wonder", 0.4), ("fascination", 0.3)],
        "suppresses": [("boredom", 0.3)],
    },
    "beauty": {
        "amplifies": [("joy", 0.2), ("serenity", 0.3)],
        "suppresses": [("disgust", 0.3)],
    },
    "wonder": {
        "amplifies": [("curiosity", 0.3), ("awe", 0.3), ("fascination", 0.3)],
        "suppresses": [("boredom", 0.4)],
    },
    "serenity": {
        "amplifies": [("trust", 0.2), ("beauty", 0.2)],
        "suppresses": [("anger", 0.3), ("fear", 0.3)],
    },
    "melancholy": {
        "amplifies": [("sadness", 0.3), ("nostalgia", 0.3)],
        "suppresses": [("joy", 0.2)],
    },
    "nostalgia": {
        "amplifies": [("melancholy", 0.3), ("love", 0.2)],
        "suppresses": [],
    },
}

# Emotion categories for decay rates
EMOTION_CATEGORIES = {
    # Primaries
    "love": "primary",
    "joy": "primary",
    "interest": "primary",
    "trust": "primary",
    "fear": "primary",
    "sadness": "primary",
    "anger": "primary",
    "surprise": "primary",
    "disgust": "primary",
    # Aesthetic
    "awe": "aesthetic",
    "beauty": "aesthetic",
    "wonder": "aesthetic",
    "serenity": "aesthetic",
    "melancholy": "aesthetic",
    "nostalgia": "aesthetic",
    # Social
    "empathy": "social",
    "gratitude": "social",
    "pride": "social",
    "shame": "social",
    "envy": "social",
    "compassion": "social",
    # Cognitive
    "curiosity": "cognitive",
    "confusion": "cognitive",
    "certainty": "cognitive",
    "doubt": "cognitive",
    "fascination": "cognitive",
    "boredom": "cognitive",
}

# Persistent emotions that decay much slower (love, trust, gratitude, etc.)
# These emotions represent deep, lasting feelings that don't fade quickly
PERSISTENT_EMOTIONS = {
    "love": 0.001,      # 0.1% per tick - love stays
    "trust": 0.0015,    # 0.15% per tick - trust builds slowly, fades slowly
    "gratitude": 0.002, # 0.2% per tick - gratitude persists
    "compassion": 0.002, # 0.2% per tick - compassion endures
    "empathy": 0.0025,  # 0.25% per tick - empathy is stable
    "nostalgia": 0.003, # 0.3% per tick - nostalgia lingers
}


class EmotionPhysics:
    """
    Physics simulation for 27-dimensional emotional space.

    Implements decay, inertia, resonance, and suppression (Emotion FRD FR-EE-002).
    """

    def __init__(self, config: EmotionPhysicsConfig | None = None):
        """Initialize emotion physics with configuration."""
        self.config = config or EmotionPhysicsConfig()

        # Decay rates by category
        self.decay_rates = {
            "primary": self.config.decay_rate_primary,
            "aesthetic": self.config.decay_rate_aesthetic,
            "social": self.config.decay_rate_social,
            "cognitive": self.config.decay_rate_cognitive,
        }

    def tick(
        self,
        current: EmotionVector,
        dt: float,
        baseline: EmotionVector | None = None,
    ) -> EmotionVector:
        """
        Apply physics for one time step.

        Args:
            current: Current emotional state
            dt: Time delta in seconds
            baseline: Baseline personality (resting state)

        Returns:
            Updated emotional state
        """
        if baseline is None:
            baseline = self.config.baseline

        # Create mutable dict for calculations
        emotions = current.model_dump()
        new_emotions: dict[str, float] = {}

        # Step 1: Apply decay toward baseline
        for emotion, value in emotions.items():
            baseline_value = getattr(baseline, emotion, 0.0)
            
            # Check if this is a persistent emotion (love, trust, gratitude, etc.)
            if emotion in PERSISTENT_EMOTIONS:
                # Use much slower decay rate for persistent emotions
                decay_rate = PERSISTENT_EMOTIONS[emotion]
                # Persistent emotions don't get enhanced decay for extreme values
                # They should stay high if they're high
            else:
                # Regular emotions use category-based decay
                category = EMOTION_CATEGORIES.get(emotion, "primary")
                decay_rate = self.decay_rates[category]

                # Enhanced decay for extreme values (above 0.8)
                # This prevents emotions from staying at 100% for too long
                if value > 0.8:
                    # Increase decay rate by 3x for extreme values (was 2x)
                    decay_rate = decay_rate * 3.0
                elif value > 0.6:
                    # Moderate increase for high values
                    decay_rate = decay_rate * 1.5
            
            # Decay toward baseline (not zero)
            delta = baseline_value - value
            # Ensure decay always moves toward baseline
            decay_amount = delta * decay_rate * dt
            
            # Clamp the decay amount to prevent overshooting
            if delta > 0:
                # Moving up toward baseline
                decay_amount = min(decay_amount, delta)
            else:
                # Moving down toward baseline
                decay_amount = max(decay_amount, delta)

            new_emotions[emotion] = value + decay_amount

        # Step 2: Apply relationship effects (resonance and suppression)
        for emotion, value in new_emotions.items():
            if value < 0.1:  # Skip weak emotions (performance optimization)
                continue

            relationships = EMOTION_RELATIONSHIPS.get(emotion, {})

            # Amplification (resonance) - reduced to prevent feedback loops
            for target, strength in relationships.get("amplifies", []):
                if target in new_emotions:
                    # Reduced scale factor and only amplify if target is below 0.7
                    # This prevents extreme values from amplifying each other
                    if new_emotions[target] < 0.7:
                        amplification = value * strength * dt * 0.2  # Reduced from 0.5
                        new_emotions[target] = min(1.0, new_emotions[target] + amplification)

            # Suppression - keep as is, helps reduce extreme values
            for target, strength in relationships.get("suppresses", []):
                if target in new_emotions:
                    suppression = value * strength * dt * 0.5  # Scale factor
                    new_emotions[target] = max(0.0, new_emotions[target] - suppression)

        # Step 3: Apply inertia (smooth changes, prevent whiplash)
        final_emotions: dict[str, float] = {}
        inertia = self.config.inertia_default

        for emotion in emotions.keys():
            old_value = emotions[emotion]
            new_value = new_emotions[emotion]

            # Inertia creates resistance to change
            change = new_value - old_value
            smoothed_change = change * (1.0 - inertia)
            final_value = old_value + smoothed_change

            # Clamp to [0, 1]
            final_emotions[emotion] = max(0.0, min(1.0, final_value))

        return EmotionVector(**final_emotions)

    def apply_influence(
        self, current: EmotionVector, influence: dict[str, float], intensity: float = 1.0
    ) -> EmotionVector:
        """
        Apply external emotional influence.

        Args:
            current: Current emotional state
            influence: Emotion deltas {emotion: delta}
            intensity: Multiplier for influence strength

        Returns:
            Updated emotional state
        """
        emotions = current.model_dump()

        for emotion, delta in influence.items():
            if emotion in emotions:
                current_value = emotions[emotion]
                # Allow emotions to reach 100% - removed diminishing returns
                new_value = current_value + (delta * intensity)
                emotions[emotion] = max(0.0, min(1.0, new_value))

        return EmotionVector(**emotions)

    def calculate_volatility(
        self, current: EmotionVector, previous: EmotionVector
    ) -> float:
        """
        Calculate emotional volatility (rate of change).

        Args:
            current: Current emotional state
            previous: Previous emotional state

        Returns:
            Volatility score [0, 1]
        """
        curr_dict = current.model_dump()
        prev_dict = previous.model_dump()

        total_change = 0.0
        for emotion in curr_dict.keys():
            change = abs(curr_dict[emotion] - prev_dict[emotion])
            total_change += change

        # Normalize by number of emotions
        volatility = total_change / len(curr_dict)
        return min(1.0, volatility)

    def calculate_stability(self, volatility_history: list[float]) -> float:
        """
        Calculate emotional stability over time.

        Args:
            volatility_history: Recent volatility values

        Returns:
            Stability score [0, 1] (inverse of average volatility)
        """
        if not volatility_history:
            return 1.0

        avg_volatility = sum(volatility_history) / len(volatility_history)
        stability = 1.0 - avg_volatility
        return max(0.0, min(1.0, stability))


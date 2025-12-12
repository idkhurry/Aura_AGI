"""
Skill tree management (Learning FRD FR-ST-001).

Hierarchical organization of knowledge: Skills → Sub-skills → Rules → Experiences
"""

import logging
from datetime import datetime
from typing import Any
from uuid import uuid4

from aura.db.client import get_db_client
from aura.models.learning import Rule, Skill

logger = logging.getLogger(__name__)


class SkillTreeManager:
    """Manage hierarchical skill tree structure."""

    def __init__(self):
        """Initialize skill tree manager."""
        self.db = get_db_client()

    async def create_skill(
        self,
        name: str,
        domain: str,
        parent_skill_id: str | None = None,
        emotional_signature: dict[str, float] | None = None,
    ) -> str:
        """
        Create a new skill node.

        Args:
            name: Skill name
            domain: Domain of knowledge
            parent_skill_id: Parent skill (for hierarchy)
            emotional_signature: Emotional association

        Returns:
            skill_id
        """
        skill_id = f"skill:{uuid4().hex[:12]}"

        try:
            skill = Skill(
                skill_id=skill_id,
                name=name,
                domain=domain,
                parent_skill_id=parent_skill_id,
                emotional_signature=emotional_signature or {},
            )

            await self.db.create("skill", skill.model_dump())

            logger.info(f"Skill created: {skill_id} ({name})")
            return skill_id

        except Exception as e:
            logger.error(f"Failed to create skill: {e}")
            raise

    async def add_rule_to_skill(self, rule_id: str, skill_id: str) -> None:
        """
        Link a rule to a skill.

        Creates skill_contains relationship in graph.
        """
        try:
            # Get current skill
            result = await self.db.select(skill_id)

            if not result:
                raise ValueError(f"Skill not found: {skill_id}")

            skill_data = result[0]
            rule_ids = skill_data.get("rule_ids", [])

            if rule_id not in rule_ids:
                rule_ids.append(rule_id)
                await self.db.merge(skill_id, {"rule_ids": rule_ids})

            # Create graph relationship
            await self.db.query(
                """
                RELATE $skill->skill_contains->$rule
                """,
                {"skill": skill_id, "rule": rule_id},
            )

            logger.debug(f"Rule {rule_id} added to skill {skill_id}")

        except Exception as e:
            logger.error(f"Failed to add rule to skill: {e}")
            raise

    async def calculate_mastery(self, skill_id: str) -> float:
        """
        Calculate mastery level for a skill.

        Based on Learning FRD FR-ST-002:
        - Sub-skill mastery (if any)
        - Rule confidence levels
        - Recent application success rate
        """
        try:
            skill_result = await self.db.select(skill_id)

            if not skill_result:
                return 0.0

            skill_data = skill_result[0]

            # Get sub-skills
            sub_skill_ids = skill_data.get("sub_skill_ids", [])
            rule_ids = skill_data.get("rule_ids", [])

            mastery_components = []

            # Sub-skill mastery (recursive)
            if sub_skill_ids:
                sub_masteries = []
                for sub_id in sub_skill_ids:
                    sub_mastery = await self.calculate_mastery(sub_id)
                    sub_masteries.append(sub_mastery)

                avg_sub_mastery = (
                    sum(sub_masteries) / len(sub_masteries) if sub_masteries else 0.0
                )
                mastery_components.append(("sub_skills", avg_sub_mastery, 0.7))

            # Rule confidence
            if rule_ids:
                rule_confidences = []
                for rule_id in rule_ids:
                    rule_result = await self.db.select(rule_id)
                    if rule_result:
                        rule_data = rule_result[0]
                        rule_confidences.append(rule_data.get("confidence", 0.0))

                avg_rule_confidence = (
                    sum(rule_confidences) / len(rule_confidences)
                    if rule_confidences
                    else 0.0
                )
                mastery_components.append(("rules", avg_rule_confidence, 0.3))

            # Weighted average
            if mastery_components:
                total_weight = sum(weight for _, _, weight in mastery_components)
                weighted_sum = sum(
                    value * weight for _, value, weight in mastery_components
                )
                mastery = weighted_sum / total_weight
            else:
                mastery = 0.0

            # Update skill mastery in database
            await self.db.merge(skill_id, {"mastery_level": mastery})

            return mastery

        except Exception as e:
            logger.error(f"Failed to calculate mastery: {e}")
            return 0.0

    async def get_skill_tree(self, root_skill_id: str) -> dict[str, Any]:
        """
        Get complete skill tree starting from root.

        Returns hierarchical structure with all sub-skills and rules.
        """
        try:
            skill_result = await self.db.select(root_skill_id)

            if not skill_result:
                return {}

            skill_data = skill_result[0]

            tree = {
                "skill_id": root_skill_id,
                "name": skill_data.get("name"),
                "domain": skill_data.get("domain"),
                "mastery_level": skill_data.get("mastery_level", 0.0),
                "sub_skills": [],
                "rules": [],
            }

            # Recursively get sub-skills
            sub_skill_ids = skill_data.get("sub_skill_ids", [])
            for sub_id in sub_skill_ids:
                sub_tree = await self.get_skill_tree(sub_id)
                tree["sub_skills"].append(sub_tree)

            # Get rules
            rule_ids = skill_data.get("rule_ids", [])
            for rule_id in rule_ids:
                rule_result = await self.db.select(rule_id)
                if rule_result:
                    rule_data = rule_result[0]
                    tree["rules"].append(
                        {
                            "rule_id": rule_id,
                            "condition": rule_data.get("condition"),
                            "confidence": rule_data.get("confidence"),
                        }
                    )

            return tree

        except Exception as e:
            logger.error(f"Failed to get skill tree: {e}")
            return {}

    async def get_all_skills(self, domain: str | None = None) -> list[dict[str, Any]]:
        """Get all skills, optionally filtered by domain."""
        try:
            if domain:
                query = f"SELECT * FROM skill WHERE domain = '{domain}'"
            else:
                query = "SELECT * FROM skill"

            result = await self.db.query(query)

            if not result:
                return []

            return result

        except Exception as e:
            logger.error(f"Failed to get skills: {e}")
            return []


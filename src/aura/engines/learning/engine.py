"""
Learning Engine - Adaptive pattern extraction and skill acquisition.

Implements Learning FRD Section 3.1 (Core Learning Loop).
"""

import logging
import asyncio
from datetime import datetime
from typing import Deque, TYPE_CHECKING
from uuid import uuid4
from collections import deque

from aura.db.client import get_db_client
from aura.engines.base import BaseEngine
from aura.llm.embeddings import get_embeddings_client
from aura.models.learning import Experience, LearningContext, Rule, Skill
from aura.models.messages import EngineMessage, MessagePriority

if TYPE_CHECKING:
    from aura.orchestrator.protocols import MessageBusProtocol
    from aura.llm.layers import LLMLayers

logger = logging.getLogger(__name__)


class LearningEngine(BaseEngine):
    """
    Learning Engine implementing 6-phase learning cycle.

    Phases: Capture → Extract → Abstract → Integrate → Transfer → Validate
    Based on Learning FRD FR-LL-001.
    """

    def __init__(self):
        """Initialize learning engine."""
        super().__init__("learning_engine")

        # Database
        self.db = get_db_client()

        # Embeddings client for semantic search
        self.embeddings = get_embeddings_client()

        # External dependencies
        self.llm_layers: "LLMLayers | None" = None
        
        # Queues
        self.pattern_extraction_queue: Deque[Experience] = deque(maxlen=1000)

        # Counters
        self.experiences_logged = 0
        self.rules_created = 0

    def set_message_bus(self, message_bus: "MessageBusProtocol") -> None:
        """Set message bus for inter-engine communication."""
        super().set_message_bus(message_bus)
        if message_bus:
            message_bus.subscribe("learning_engine", self._handle_message)

    def set_llm_layers(self, llm_layers: "LLMLayers") -> None:
        """Set LLM layers for background analysis."""
        self.llm_layers = llm_layers

    async def initialize(self) -> None:
        """Initialize engine resources."""
        self.logger.info("Initializing Learning Engine...")

        # Load statistics
        try:
            # Optimized stats loading
            stats_result = await self.db.query("SELECT value FROM stats WHERE key = 'total_experiences'")
            if stats_result and len(stats_result) > 0:
                self.experiences_logged = stats_result[0].get("value", 0)
            else:
                # Fallback if stats not initialized
                exp_result = await self.db.query("SELECT count() FROM experience GROUP ALL")
                if exp_result:
                    self.experiences_logged = exp_result[0].get("count", 0)

            rule_result = await self.db.query("SELECT count() FROM rule GROUP ALL")
            if rule_result:
                self.rules_created = rule_result[0].get("count", 0)
        except Exception as e:
            self.logger.warning(f"Could not load statistics: {e}")

        self.logger.info(
            f"Learning Engine initialized - "
            f"Experiences: {self.experiences_logged}, Rules: {self.rules_created}"
        )

    async def tick(self) -> None:
        """
        Execute learning engine cycles.
        Check queue frequently (1s) instead of blocking for 60s.
        """
        while True:
            # Process pattern extraction queue
            if self.pattern_extraction_queue and self.llm_layers:
                # Process one batch (up to 5 items)
                batch_size = min(5, len(self.pattern_extraction_queue))
                batch = [self.pattern_extraction_queue.popleft() for _ in range(batch_size)]
                
                if batch:
                    self.logger.debug(f"Processing batch of {len(batch)} items from queue")
                    for experience in batch:
                        await self._process_pattern_extraction(experience)
            
            await asyncio.sleep(1.0)

    async def _process_pattern_extraction(self, experience: Experience) -> None:
        """Process a single experience for pattern extraction using L5."""
        try:
            # Query similar experiences
            similar = await self.db.query(
                "SELECT * FROM experience WHERE domain = $domain AND task_type = $task_type LIMIT 5",
                {"domain": experience.domain, "task_type": experience.task_type}
            )
            
            if not similar or len(similar) < 3:
                return

            # Construct prompt for L5
            context_str = "\n".join([
                f"- Input: {e.get('context', {}).get('user_query', '')} -> Response: {e.get('aura_response', {}).get('response', '')} (Outcome: {e.get('outcome', {})})" 
                for e in similar
            ])
            
            prompt = f"""Analyze these similar interaction experiences to extract a general rule.

Domain: {experience.domain}
Task: {experience.task_type}

Experiences:
{context_str}

Task:
Extract a generalized Rule that explains the successful outcome or corrects a failure.

Output JSON:
{{
  "condition": "If context involves X...",
  "action": "Then do Y...",
  "rationale": "Because observed pattern Z...",
  "confidence": 0.7
}}
"""
            # Use L5 structure analysis
            result = await self.llm_layers.l5_structure_analysis(
                prompt=prompt, 
                system_instruction="Pattern Extractor"
            )
            
            if result and result.get("condition") and result.get("action"):
                # Create the rule
                rule_data = {
                    "condition": result["condition"],
                    "action": result["action"],
                    "rationale": result.get("rationale", "Extracted from pattern analysis"),
                    "domain": experience.domain,
                    "task_type": experience.task_type,
                    "confidence": result.get("confidence", 0.5),
                    "source_experiences": [e.get("id", "") for e in similar]
                }
                await self.create_rule(rule_data)
                
        except Exception as e:
            self.logger.error(f"Background pattern extraction failed: {e}")

    async def shutdown(self) -> None:
        """Clean up engine resources."""
        self.logger.info("Shutting down Learning Engine...")
        self.logger.info(f"Final stats - Experiences: {self.experiences_logged}, Rules: {self.rules_created}")

    # Phase 1: Experience Capture

    async def log_experience(self, experience_data: dict) -> str:
        """
        Log an interaction experience with semantic embedding.

        Args:
            experience_data: Experience details (user_id, task_type, context, etc.)

        Returns:
            experience_id
        """
        experience_id = f"experience:{uuid4().hex[:12]}"

        try:
            # Ensure required fields
            experience = Experience(
                experience_id=experience_id,
                user_id=experience_data.get("user_id", "default"),
                task_type=experience_data.get("task_type", "unknown"),
                domain=experience_data.get("domain", "general"),
                context=experience_data.get("context", {}),
                aura_response=experience_data.get("aura_response", {}),
                outcome=experience_data.get("outcome", {}),
                emotional_state=experience_data.get("emotional_state", {}),
                metadata=experience_data.get("metadata", {}),
            )

            # Generate embedding for semantic clustering (Background)
            context_text = str(experience.context.get("user_query", ""))
            if context_text:
                asyncio.create_task(self._generate_embedding_later(experience_id, context_text))

            # Store in database
            await self.db.create("experience", experience.model_dump())

            self.experiences_logged += 1
            
            # Persist stats periodically
            if self.experiences_logged % 100 == 0:
                try:
                    await self.db.query(
                        "INSERT INTO stats (key, value) VALUES ('total_experiences', $value) ON DUPLICATE KEY UPDATE value = $value",
                        {"value": self.experiences_logged}
                    )
                except Exception as e:
                    self.logger.warning(f"Failed to update stats: {e}")

            self.logger.info(f"Experience logged: {experience_id} ({experience.task_type})")

            # Check for pattern extraction opportunity
            await self._check_pattern_extraction(experience)

            return experience_id

        except Exception as e:
            self.logger.error(f"Failed to log experience: {e}")
            raise

    async def _generate_embedding_later(self, exp_id: str, text: str) -> None:
        """Generate and save embedding in background."""
        try:
            embedding = await self.embeddings.embed(text)
            if embedding:
                await self.db.merge(exp_id, {"embedding": embedding})
                self.logger.debug(f"Generated embedding for experience {exp_id}")
        except Exception as e:
            self.logger.error(f"Failed to generate background embedding: {e}")

    # Phase 5: Transfer (Rule Retrieval)

    async def retrieve_rules(
        self,
        context: str,
        domain: str | None = None,
        confidence_min: float = 0.5,
        user_id: str | None = None,
        limit: int = 10,
        use_semantic_search: bool = True,
    ) -> list[Rule]:
        """
        Retrieve relevant rules using hybrid search (semantic + filters).

        Args:
            context: Context description
            domain: Filter by domain
            confidence_min: Minimum confidence threshold
            user_id: Filter for user-specific rules
            limit: Maximum rules to return
            use_semantic_search: Use vector similarity (requires context embedding)

        Returns:
            List of relevant rules sorted by relevance
        """
        try:
            # Strategy 1: Semantic search if context provided
            if use_semantic_search and context:
                # Generate embedding for context
                context_embedding = await self.embeddings.embed(context)

                if context_embedding:
                    # Use vector similarity search (cosine distance via <->)
                    # Lower distance = higher similarity
                    
                    # Parameterized query construction
                    query_params = {
                        "query_embedding": context_embedding,
                        "domain": domain, 
                        "user_id": user_id,
                        "confidence_min": confidence_min
                    }
                    
                    filter_conditions = ["deprecated = false"]
                    if domain:
                        filter_conditions.append("domain = $domain")
                    if user_id:
                        filter_conditions.append("(user_specific = false OR user_id = $user_id)")
                    
                    filter_clause = " AND ".join(filter_conditions)
                    
                    # Using <-> operator for distance. Sort ASC for most similar.
                    query = f"""
                        SELECT *, embedding <-> $query_embedding AS distance
                        FROM rule
                        WHERE {filter_clause}
                        ORDER BY distance ASC, confidence DESC
                        LIMIT {limit}
                    """
                    
                    result = await self.db.query(query, query_params)
                    
                    if result:
                        rules = [Rule(**rule_data) for rule_data in result]
                        self.logger.debug(f"Retrieved {len(rules)} rules via vector search")
                        return rules
                    
                    self.logger.debug("Vector search returned no results, falling back to filtered search")

            # Strategy 2: Filtered search (fallback or when no context)
            query_params = {
                "confidence_min": confidence_min,
                "domain": domain,
                "user_id": user_id
            }
            
            conditions = ["confidence >= $confidence_min", "deprecated = false"]

            if domain:
                conditions.append("domain = $domain")

            if user_id:
                conditions.append("(user_specific = false OR user_id = $user_id)")

            where_clause = " AND ".join(conditions)

            query = f"""
                SELECT * FROM rule
                WHERE {where_clause}
                ORDER BY confidence DESC, application_count DESC
                LIMIT {limit}
            """

            result = await self.db.query(query, query_params)

            if not result:
                return []

            rules = [Rule(**rule_data) for rule_data in result]

            self.logger.debug(f"Retrieved {len(rules)} rules for context")
            return rules

        except Exception as e:
            self.logger.error(f"Failed to retrieve rules: {e}")
            return []

    async def get_learning_context(
        self,
        context: str,
        domain: str | None = None,
        user_id: str | None = None,
    ) -> LearningContext:
        """
        Get complete learning context for LLM injection.

        Args:
            context: Task context
            domain: Domain filter
            user_id: User ID for personalized rules

        Returns:
            Learning context with rules, confidence, mastery
        """
        rules = await self.retrieve_rules(
            context=context, domain=domain, user_id=user_id
        )

        # Calculate overall confidence and mastery
        if rules:
            avg_confidence = sum(r.confidence for r in rules) / len(rules)
            mastery_level = self._calculate_mastery_from_rules(rules)
        else:
            avg_confidence = 0.0
            mastery_level = 0.0

        return LearningContext(
            rules=rules,
            confidence_level=avg_confidence,
            mastery_level=mastery_level,
        )

    # Rule Management

    async def create_rule(self, rule_data: dict) -> str:
        """
        Create a new learned rule with semantic embedding.

        Args:
            rule_data: Rule specification

        Returns:
            rule_id
        """
        rule_id = f"rule:{uuid4().hex[:12]}"

        try:
            rule = Rule(
                rule_id=rule_id,
                condition=rule_data["condition"],
                action=rule_data["action"],
                rationale=rule_data.get("rationale", ""),
                domain=rule_data.get("domain", "general"),
                task_type=rule_data.get("task_type", "unknown"),
                confidence=rule_data.get("confidence", 0.5),
                emotional_signature=rule_data.get("emotional_signature", {}),
                user_specific=rule_data.get("user_specific", False),
                source_experiences=rule_data.get("source_experiences", []),
            )

            # Generate embedding for semantic retrieval
            # Combine condition + action for meaningful representation
            rule_text = f"{rule.condition} → {rule.action}"
            embedding = await self.embeddings.embed(rule_text)
            if embedding:
                rule.embedding = embedding
                self.logger.debug(f"Generated embedding for rule {rule_id}")

            await self.db.create("rule", rule.model_dump())

            self.rules_created += 1
            self.logger.info(f"Rule created: {rule_id} ({rule.domain})")

            # Broadcast rule creation
            if self._message_bus:
                message = EngineMessage.create_state_update(
                    source="learning_engine",
                    data={"rule_id": rule_id, "domain": rule.domain, "confidence": rule.confidence},
                    targets=["orchestrator", "emotion_engine"],
                    priority=MessagePriority.NORMAL,
                )
                await self._message_bus.publish(message)

            return rule_id

        except Exception as e:
            self.logger.error(f"Failed to create rule: {e}")
            raise

    async def update_rule_confidence(
        self, rule_id: str, success: bool, resolution_time: float | None = None
    ) -> None:
        """
        Update rule confidence based on application outcome (Bayesian updating).

        Args:
            rule_id: Rule identifier
            success: Whether rule application succeeded
            resolution_time: Time to resolution (for statistics)
        """
        try:
            # Get current rule
            result = await self.db.select(rule_id)

            if not result:
                return

            rule_data = result[0]

            # Update counts
            application_count = rule_data.get("application_count", 0) + 1
            success_count = rule_data.get("success_count", 0) + (1 if success else 0)
            fail_count = rule_data.get("fail_count", 0) + (0 if success else 1)

            # Bayesian update of confidence
            # Simple formula: (successes + 1) / (total + 2)
            new_confidence = (success_count + 1) / (application_count + 2)

            updates = {
                "application_count": application_count,
                "success_count": success_count,
                "fail_count": fail_count,
                "confidence": new_confidence,
                "last_used": datetime.utcnow().isoformat(),
            }

            if resolution_time is not None:
                # Update moving average
                old_avg = rule_data.get("avg_resolution_time", 0.0)
                updates["avg_resolution_time"] = (
                    old_avg * (application_count - 1) + resolution_time
                ) / application_count

            await self.db.merge(rule_id, updates)

            self.logger.debug(
                f"Rule {rule_id} updated: confidence={new_confidence:.2f}, "
                f"success_rate={success_count}/{application_count}"
            )

            # Check for deprecation
            if new_confidence < 0.4 and application_count > 10:
                await self.db.merge(rule_id, {"deprecated": True})
                self.logger.info(f"Rule {rule_id} deprecated (low confidence)")

        except Exception as e:
            self.logger.error(f"Failed to update rule confidence: {e}")

    # Skill Tree

    async def get_skill(self, skill_id: str) -> Skill | None:
        """Get skill by ID."""
        try:
            result = await self.db.select(skill_id)

            if not result:
                return None

            return Skill(**result[0])

        except Exception as e:
            self.logger.error(f"Failed to get skill: {e}")
            return None

    async def get_skills_by_domain(self, domain: str) -> list[Skill]:
        """Get all skills in a domain."""
        try:
            result = await self.db.query(
                f"SELECT * FROM skill WHERE domain = '{domain}'"
            )

            if not result:
                return []

            return [Skill(**s) for s in result]

        except Exception as e:
            self.logger.error(f"Failed to get skills: {e}")
            return []

    # Private methods

    async def _check_pattern_extraction(self, experience: Experience) -> None:
        """
        Check if enough similar experiences exist to extract patterns.

        Triggers pattern extraction when threshold is met.
        """
        try:
            # Query similar experiences by domain and task_type
            result = await self.db.query(
                """
                SELECT count() FROM experience
                WHERE domain = $domain AND task_type = $task_type
                GROUP ALL
                """,
                {"domain": experience.domain, "task_type": experience.task_type},
            )

            if result:
                count = result[0].get("count", 0)

                # Trigger pattern extraction at threshold (5+ similar experiences)
                if count >= 5 and count % 5 == 0:
                    self.logger.info(
                        f"Pattern extraction threshold met: {experience.domain}/{experience.task_type} "
                        f"({count} experiences)"
                    )
                    # Queue pattern extraction task for L2/L5
                    self.pattern_extraction_queue.append(experience)

        except Exception as e:
            self.logger.error(f"Failed to check pattern extraction: {e}")

    def _calculate_mastery_from_rules(self, rules: list[Rule]) -> float:
        """Calculate overall mastery level from retrieved rules."""
        if not rules:
            return 0.0

        # Weight by confidence and success rate
        total_weight = 0.0
        weighted_sum = 0.0

        for rule in rules:
            if rule.application_count > 0:
                success_rate = rule.success_count / rule.application_count
                weight = rule.confidence * success_rate
                weighted_sum += weight
                total_weight += 1.0

        return weighted_sum / total_weight if total_weight > 0 else 0.0

    async def _handle_message(self, message: EngineMessage) -> None:
        """Handle incoming messages from other engines."""
        if message.type == "propose_rule":
            # Process proposed rule from L2/Orchestrator
            payload = message.data
            self.logger.info(f"Received rule proposal: {payload.get('condition')} -> {payload.get('action')}")
            
            try:
                # Create the rule immediately (or could queue for review)
                # For now, we trust L2's high confidence patterns
                rule_data = {
                    "condition": payload.get("condition"),
                    "action": payload.get("action"),
                    "rationale": payload.get("rationale", "Proposed by L2"),
                    "domain": payload.get("domain", "general"),
                    "confidence": payload.get("confidence", 0.5),
                    "source_experiences": [], # No direct experience link in this flow yet
                    "task_type": "conversation_pattern"
                }
                await self.create_rule(rule_data)
            except Exception as e:
                self.logger.error(f"Failed to create proposed rule: {e}")
        
        elif message.type == "trigger_extraction":
            # Trigger manual pattern extraction (e.g. from Reflection Engine)
            # Query recent experiences respecting domain
            try:
                domain = message.data.get("domain")
                query = "SELECT * FROM experience "
                params = {}
                
                if domain:
                    query += "WHERE domain = $domain "
                    params["domain"] = domain
                
                query += "ORDER BY timestamp DESC LIMIT 5"
                
                recent_exps = await self.db.query(query, params)

                if recent_exps:
                    for exp_data in recent_exps:
                        exp = Experience(**exp_data)
                        self.pattern_extraction_queue.append(exp)
                    self.logger.info(f"Triggered manual pattern extraction for recent experiences (domain: {domain})")
            except Exception as e:
                self.logger.error(f"Failed to trigger extraction: {e}")

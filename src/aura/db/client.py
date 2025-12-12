"""SurrealDB async client wrapper."""

import logging
from typing import Any

from surrealdb import AsyncSurreal

from aura.config import settings

logger = logging.getLogger(__name__)


class DatabaseClient:
    """Async SurrealDB client wrapper with connection pooling."""

    def __init__(self) -> None:
        """Initialize database client."""
        self._client: AsyncSurreal | None = None
        self._connected: bool = False

    @property
    def is_connected(self) -> bool:
        """Check if database is connected."""
        return self._connected and self._client is not None

    async def connect(self) -> None:
        """Establish database connection."""
        if self._connected:
            logger.warning("Database already connected")
            return

        try:
            # Create async client
            self._client = AsyncSurreal(settings.surreal_url)
            
            # Connect to the database
            await self._client.connect()

            # Sign in as root user (system level)
            # For root users, we need to use the root scope
            logger.info(f"Attempting root signin with user: '{settings.surreal_user}'")
            try:
                # Try root-level authentication
                await self._client.signin({
                    "username": settings.surreal_user,
                    "password": settings.surreal_pass,
                })
                logger.info("Signed in with username/password format")
            except Exception as e:
                logger.warning(f"Username/password signin failed: {e}, trying user/pass format")
                await self._client.signin({
                    "user": settings.surreal_user,
                    "pass": settings.surreal_pass,
                })
                logger.info("Signed in with user/pass format")

            # Use namespace and database
            await self._client.use(settings.surreal_ns, settings.surreal_db)

            self._connected = True
            logger.info(
                f"Connected to SurrealDB: {settings.surreal_ns}/{settings.surreal_db}"
            )

        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            self._connected = False
            raise

    async def close(self) -> None:
        """Close database connection."""
        if self._client and self._connected:
            await self._client.close()
            self._connected = False
            logger.info("Database connection closed")

    def _normalize_response(self, result: Any) -> list[dict[str, Any]]:
        """
        Universal normalizer for SurrealDB responses.
        Handles all these formats:
        - Direct: [{...}, {...}]
        - Wrapped: [{"result": [{...}]}]
        - Single: {"result": [{...}]}
        - Empty: [], [{"result": []}], None
        """
        if not result:
            return []

        # If it's a dict with 'result' key
        if isinstance(result, dict) and "result" in result:
            res = result["result"]
            normalized = res if isinstance(res, list) else [res]
            logger.debug(f"Normalized dict response: {len(normalized)} items")
            return normalized

        # If it's a list
        if isinstance(result, list):
            if len(result) == 0:
                return []

            # Check first item
            first = result[0]

            # If first item has 'result' key (wrapped format)
            if isinstance(first, dict) and "result" in first:
                res = first["result"]
                normalized = res if isinstance(res, list) else [res]
                logger.debug(f"Normalized wrapped response: {len(normalized)} items")
                return normalized

            # Otherwise it's direct format
            logger.debug(f"Direct list response: {len(result)} items")
            return result

        # Single item
        return [result]

    async def query(self, sql: str, vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """Execute a SurrealQL query and return normalized results."""
        if not self._client:
            raise RuntimeError("Database not connected")
        result = await self._client.query(sql, vars)
        return self._normalize_response(result)

    async def select(self, thing: str) -> list[dict[str, Any]]:
        """Select records from a table and return normalized results."""
        if not self._client:
            raise RuntimeError("Database not connected")
        result = await self._client.select(thing)
        return self._normalize_response(result)

    async def create(self, thing: str, data: dict[str, Any]) -> Any:
        """Create a record."""
        if not self._client:
            raise RuntimeError("Database not connected")
        return await self._client.create(thing, data)

    async def update(self, thing: str, data: dict[str, Any]) -> Any:
        """Update a record."""
        if not self._client:
            raise RuntimeError("Database not connected")
        return await self._client.update(thing, data)

    async def merge(self, thing: str, data: dict[str, Any]) -> Any:
        """Merge data into a record."""
        if not self._client:
            raise RuntimeError("Database not connected")
        return await self._client.merge(thing, data)

    async def delete(self, thing: str) -> Any:
        """Delete a record."""
        if not self._client:
            raise RuntimeError("Database not connected")
        return await self._client.delete(thing)


# Global database client instance
_db_client: DatabaseClient | None = None


def get_db_client() -> DatabaseClient:
    """Get the global database client instance."""
    global _db_client
    if _db_client is None:
        _db_client = DatabaseClient()
    return _db_client


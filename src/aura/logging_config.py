"""Custom logging configuration for uvicorn."""
import logging


class HealthCheckFilter(logging.Filter):
    """Filter out noisy polling requests from access logs."""
    
    # Endpoints to silence
    NOISY_ENDPOINTS = ['/health', '/emotion/current', '/memory/recent', '/api/conversations/', '/goal/active']
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Filter out health checks, emotion polls, and memory polls."""
        # Check if this is an access log message
        if hasattr(record, 'args') and record.args:
            message = str(record.getMessage())
            # Filter out any of the noisy endpoints
            for endpoint in self.NOISY_ENDPOINTS:
                if endpoint in message and 'GET' in message:
                    return False
        return True


def setup_logging_filters():
    """Set up logging filters to reduce noise."""
    # Get uvicorn access logger
    access_logger = logging.getLogger("uvicorn.access")
    
    # Add health check filter
    access_logger.addFilter(HealthCheckFilter())
    
    logging.info("Custom logging filters applied")


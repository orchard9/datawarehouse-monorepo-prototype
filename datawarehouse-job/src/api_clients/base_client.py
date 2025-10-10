#!/usr/bin/env python3
"""
Base API client with shared functionality for authentication, retries, and error handling
"""
import requests
from typing import Dict, Any, Optional
import time
from datetime import datetime, timezone

class BaseApiClient:
    """Base class for all API clients with shared functionality"""
    
    def __init__(self, base_url: str, bearer_token: str, timeout: int = 30):
        self.base_url = base_url.rstrip('/')
        self.bearer_token = bearer_token
        self.timeout = timeout
        self.session = requests.Session()
        
        # Set default headers
        self.session.headers.update({
            'Authorization': f'Bearer {bearer_token}',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'PeachAI-DataWarehouse/1.0'
        })
    
    def _make_request(self, method: str, endpoint: str, params: Dict[str, Any] = None,
                     data: Dict[str, Any] = None, max_retries: int = 3) -> Dict[str, Any]:
        """Make HTTP request with retry logic and error handling"""
        url = f"{self.base_url}{endpoint}"
        
        for attempt in range(max_retries + 1):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    params=params,
                    json=data,
                    timeout=self.timeout
                )
                
                # Log request for debugging
                print(f"[{datetime.now(timezone.utc)}] {method} {url} - Status: {response.status_code}")
                
                # Handle different status codes
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 401:
                    raise AuthenticationError("Invalid or expired bearer token")
                elif response.status_code == 429:
                    # Rate limited - wait and retry
                    if attempt < max_retries:
                        wait_time = 2 ** attempt  # Exponential backoff
                        print(f"Rate limited. Waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise RateLimitError("Rate limit exceeded")
                elif response.status_code >= 500:
                    # Server error - retry
                    if attempt < max_retries:
                        wait_time = 2 ** attempt
                        print(f"Server error {response.status_code}. Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        raise ServerError(f"Server error: {response.status_code}")
                else:
                    # Client error - don't retry, print response body for debugging
                    try:
                        error_body = response.text
                        print(f"ERROR RESPONSE BODY: {error_body}")
                    except Exception:
                        print("ERROR: Could not read response body")
                    response.raise_for_status()
                    
            except requests.exceptions.Timeout:
                if attempt < max_retries:
                    print(f"Request timeout. Retrying attempt {attempt + 1}...")
                    time.sleep(1)
                    continue
                else:
                    raise TimeoutError(f"Request timed out after {max_retries + 1} attempts")
                    
            except requests.exceptions.ConnectionError:
                if attempt < max_retries:
                    print(f"Connection error. Retrying attempt {attempt + 1}...")
                    time.sleep(2)
                    continue
                else:
                    raise ConnectionError(f"Failed to connect after {max_retries + 1} attempts")
        
        # Should not reach here
        raise Exception("Unexpected error in request handling")
    
    def get(self, endpoint: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make GET request"""
        return self._make_request('GET', endpoint, params=params)
    
    def post(self, endpoint: str, data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make POST request"""
        return self._make_request('POST', endpoint, data=data)
    
    def health_check(self) -> bool:
        """Check if API is healthy"""
        try:
            response = self.get('/health')
            return response.get('status') == 'healthy'
        except Exception:
            return False

# Custom exceptions
class ApiClientError(Exception):
    """Base exception for API client errors"""
    pass

class AuthenticationError(ApiClientError):
    """Authentication failed"""
    pass

class RateLimitError(ApiClientError):
    """Rate limit exceeded"""
    pass

class ServerError(ApiClientError):
    """Server error occurred"""
    pass

class TimeoutError(ApiClientError):
    """Request timed out"""
    pass

class ConnectionError(ApiClientError):
    """Connection failed"""
    pass
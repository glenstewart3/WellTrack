"""Theme feature backend tests - PUT /api/auth/preferences and GET /api/auth/me"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

SESSION_TOKEN = "test_theme_session_placeholder"  # Will be overridden by fixture


def get_session():
    """Get a valid session token from MongoDB"""
    import subprocess
    result = subprocess.run(
        ['mongosh', '--quiet', '--eval', '''
use('test_database');
var u = db.users.findOne({user_id: 'test-theme-user'});
if (!u) { print('NO_USER'); } else {
  var s = db.user_sessions.findOne({user_id: 'test-theme-user'});
  if (!s) { print('NO_SESSION'); } else { print(s.session_token); }
}
'''],
        capture_output=True, text=True
    )
    lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip()]
    return lines[-1] if lines else None


@pytest.fixture(scope='module')
def session_headers():
    token = get_session()
    if not token or token in ('NO_USER', 'NO_SESSION'):
        pytest.skip('No test user session available')
    return {'Cookie': f'session_token={token}'}


class TestThemeAPI:
    """Tests for theme preference endpoints"""

    def test_get_me_returns_200(self, session_headers):
        resp = requests.get(f'{BASE_URL}/api/auth/me', headers=session_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert 'user_id' in data or 'email' in data

    def test_get_me_returns_theme_field(self, session_headers):
        # First reset theme to default
        requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'default'}, headers=session_headers)
        resp = requests.get(f'{BASE_URL}/api/auth/me', headers=session_headers)
        assert resp.status_code == 200
        data = resp.json()
        # theme field should be present or default to 'default'
        theme = data.get('theme', 'default')
        assert theme in ('default', 'ocean', 'forest', 'warm', 'dark', 'midnight')

    def test_put_preferences_ocean(self, session_headers):
        resp = requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'ocean'}, headers=session_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert 'message' in data

    def test_put_preferences_ocean_persisted(self, session_headers):
        requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'ocean'}, headers=session_headers)
        resp = requests.get(f'{BASE_URL}/api/auth/me', headers=session_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get('theme') == 'ocean'

    def test_put_preferences_forest(self, session_headers):
        resp = requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'forest'}, headers=session_headers)
        assert resp.status_code == 200

    def test_put_preferences_forest_persisted(self, session_headers):
        requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'forest'}, headers=session_headers)
        resp = requests.get(f'{BASE_URL}/api/auth/me', headers=session_headers)
        assert resp.json().get('theme') == 'forest'

    def test_put_preferences_warm(self, session_headers):
        resp = requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'warm'}, headers=session_headers)
        assert resp.status_code == 200

    def test_put_preferences_dark(self, session_headers):
        resp = requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'dark'}, headers=session_headers)
        assert resp.status_code == 200

    def test_put_preferences_midnight(self, session_headers):
        resp = requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'midnight'}, headers=session_headers)
        assert resp.status_code == 200

    def test_put_preferences_default(self, session_headers):
        resp = requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'default'}, headers=session_headers)
        assert resp.status_code == 200

    def test_put_preferences_invalid_theme(self, session_headers):
        resp = requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'purple'}, headers=session_headers)
        assert resp.status_code == 400

    def test_put_preferences_requires_auth(self):
        resp = requests.put(f'{BASE_URL}/api/auth/preferences', json={'theme': 'ocean'})
        assert resp.status_code in (401, 403)

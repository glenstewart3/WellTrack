# MTSS WellTrack Platform — Auth Testing Guide

## Step 1: Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: '',
  role: 'admin',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Test auth endpoint
curl -X GET "$API_URL/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test students endpoint
curl -X GET "$API_URL/api/students" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test analytics
curl -X GET "$API_URL/api/analytics/tier-distribution" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test alerts
curl -X GET "$API_URL/api/alerts" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## Step 3: Browser Testing
```python
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "tier-track-1.preview.emergentagent.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}])
await page.goto("https://welltrack-preview.preview.emergentagent.com")
```

## Checklist
- [ ] User document has user_id field
- [ ] Session user_id matches user's user_id exactly
- [ ] /api/auth/me returns user data with Bearer token
- [ ] Dashboard loads without redirect
- [ ] Students data visible (seeded)
- [ ] Alerts visible
- [ ] Interventions visible
- [ ] Analytics charts load

## Success Indicators
✅ /api/auth/me returns user data
✅ Dashboard loads without redirect
✅ All CRUD operations work

## Failure Indicators
❌ "User not found" errors
❌ 401 Unauthorized responses
❌ Redirect to login page

# Security Improvements for Enterprise Application

## Overview
This document outlines the security enhancements implemented to protect the workshop board application against unauthorized modifications and financial fraud, particularly relevant for dealership environments where users may attempt to modify job orders for personal gain.

## Key Security Enhancements

### 1. Enhanced Audit Logging System

**Location:** `server/src/models/AuditLog.ts`, `server/src/utils/auditLogger.ts`

**Features:**
- **Immutable Audit Trail**: Audit logs cannot be modified or deleted once created
- **Before/After State Tracking**: Captures complete document state before and after changes
- **Field-Level Change Detection**: Tracks exactly which fields changed, with old and new values
- **Field Classification**: Categorizes changes as financial, assignment, status, metadata, or other
- **Suspicious Activity Detection**: Automatically flags suspicious patterns:
  - Modifications to completed job orders (status CP/FR)
  - Modifications to old jobs (>30 days)
  - Rapid status changes (potential fraud indicators)
  - Unusual time range modifications (>2 hour differences)

**Usage:**
```typescript
const auditLogger = require('./utils/auditLogger')
await auditLogger.audit(
  'update',
  'JobOrder',
  jobId,
  { req, userId, userRole, requestBody },
  beforeState,
  afterState
)
```

### 2. JWT Security Enhancements

**Location:** `server/src/middleware/jwtSecurity.ts`

**Protection Against Token Theft:**
- **Token ID Tracking**: Each JWT includes a unique token ID (JTI) for session tracking
- **IP Binding**: Tracks IP address associated with each token session
- **Session Validation**: Validates that tokens are used from the same IP they were issued to
- **Concurrent Session Limits**: Detects and logs when a user has too many active sessions (>3), indicating potential account sharing
- **Suspicious Activity Logging**: Automatically logs when tokens are used from different IPs

**Note on Token Security:**
- Tokens are encrypted in HTTP-only cookies (cannot be accessed via JavaScript/XSS)
- Tokens are short-lived (15 minutes)
- Even if a token is stolen, IP mismatches are logged and flagged
- For maximum security, consider implementing token blacklisting on suspicious activity

**Limitation:** If someone physically gains access to the encrypted cookie, they could use it until expiration. The system logs this activity but cannot prevent it entirely without additional measures (2FA, device fingerprinting, etc.).

### 3. Rate Limiting

**Location:** `server/src/middleware/rateLimiter.ts`

**Protection Levels:**
- **Authentication Endpoints**: 5 login attempts per 15 minutes per IP
- **Auth Verification Endpoints**: 100 requests per minute (very lenient for normal React component usage)
- **API Endpoints**: 200 requests per 15 minutes per user/IP
- **Job Order Modifications**: 50 modifications per hour per user

**Smart Exclusions:**
- Health check endpoints
- Public maintenance status endpoint
- Auth verification endpoints (`/api/auth/me`, `/api/users/me`) - handled separately

**Why This Matters:**
Prevents brute force attacks, API abuse, and ensures that even if someone gains unauthorized access, they cannot make rapid-fire changes that would be difficult to track.

### 4. Data Integrity Safeguards

**Location:** `server/src/controllers/jobOrders.ts`

**Restrictions:**
1. **Completed Jobs**: Cannot modify financial fields on jobs with status `CP` (Complete)
2. **Old Jobs**: Jobs older than 30 days flagged when financial fields are modified
3. **Status Transitions**: Validated state machine ensures only legal status transitions
4. **Technician Limits**: Enforced 7.5 hour daily limit per technician
5. **Time Conflict Detection**: Prevents double-booking of technicians

**Audit Trail:**
All modifications include:
- Full before/after state
- Field-level changes
- User who made the change
- IP address and user agent
- Timestamp
- Suspicious activity flags

### 5. Dual Approval System

**Status:** Removed

**Reason:** Single job controller scenario - dual approval not feasible.

**Alternative:** Enhanced audit logging provides complete forensic trail for review. All changes are logged with full context, allowing administrators to review any suspicious modifications after the fact.

## Protecting Against Common Attack Vectors

### 1. Stolen JWT Tokens

**Risk:** If someone steals an encrypted cookie token, they could impersonate the user.

**Mitigations:**
- Tokens expire after 15 minutes
- IP address validation (logged if different IP detected)
- Session tracking (concurrent session limits)
- All activity is logged with IP addresses
- Tokens cannot be accessed via JavaScript (HTTP-only cookies)

**Recommendation:** For production, consider adding:
- Two-factor authentication (2FA)
- Device fingerprinting
- Token blacklisting on logout
- Refresh token rotation

### 2. Rapid Job Order Modifications

**Risk:** Users might try to make many rapid changes to hide fraudulent activity.

**Mitigations:**
- Rate limiting (50 modifications per hour)
- Complete audit trail with timestamps
- Before/after state tracking
- Suspicious activity detection

### 3. Modifying Historical/Completed Jobs

**Risk:** Users might modify old or completed jobs to adjust financial records.

**Mitigations:**
- Automatic detection of modifications to completed jobs (status CP)
- Detection of modifications to jobs older than 30 days
- Both scenarios flagged as suspicious and logged with high severity
- Complete audit trail for forensic review

### 4. Excessive Auth Requests

**Risk:** Multiple React components calling auth endpoints could trigger rate limits.

**Mitigation:**
- Special lenient rate limiter for auth verification endpoints (100/min)
- React Query caching reduces actual API calls
- Excluded from standard API rate limiting

## Implementation Notes

### Rate Limiting for Frontend API Routes

The Next.js API routes (`/api/auth/me`, `/api/users/me`) should NOT use strict rate limiting as they are called frequently by React components on page load. These endpoints are excluded from the standard rate limiter.

### Audit Log Retention

Audit logs are immutable and should be retained for compliance. Consider:
- Archival strategy for old logs
- Backup and disaster recovery
- Read-only access to audit logs
- Regular review of suspicious activity logs

### Monitoring

Set up alerts for:
- High severity audit logs
- Suspicious activity flags
- Rate limit violations
- Concurrent session violations
- IP address changes on tokens

## Best Practices

1. **Regular Audit Review**: Review audit logs regularly, especially high-severity and suspicious activity entries
2. **User Training**: Educate users that all actions are logged and monitored
3. **Access Control**: Implement principle of least privilege - users should only have access to what they need
4. **Token Management**: Implement logout functionality that invalidates tokens
5. **Monitoring Dashboard**: Consider building a dashboard for reviewing suspicious activity

## Future Enhancements

1. **Two-Factor Authentication (2FA)**: Add 2FA for sensitive operations
2. **Token Blacklisting**: Implement Redis-based token blacklist
3. **Device Fingerprinting**: Track devices to detect unauthorized access
4. **Automated Alerts**: Email/SMS alerts for critical security events
5. **Backup Encryption**: Encrypt audit logs at rest
6. **API Request Signing**: Sign critical API requests to prevent replay attacks


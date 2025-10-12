# Workshop Board Application - Workflow Documentation

## 📋 Complete Workflow Overview

This document describes the complete logical flow of job orders from creation to completion in the Workshop Board Application.

---

## 🔄 Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     JOB ORDER LIFECYCLE                         │
└─────────────────────────────────────────────────────────────────┘

CREATE → OG/WP ────────┐
         ↓             │
    [PROCESSING]       │
    - Mark Tasks       │
    - Update Parts     │
    - Reassign Tech    │
         ↓             │
      Hold States ←────┘
      (HC/HW/HI)
         ↓
    All Tasks Done
    All Parts Ready
         ↓
    [SUBMIT QI] ──────→ QI (pending)
                          ↓
                    ┌─────┴─────┐
                    ↓           ↓
                APPROVE      REJECT
                    ↓           ↓
                   FR ────→    OG
                    ↓       (redo)
              ┌─────┴─────┐
              ↓           ↓
          COMPLETE      REDO
              ↓           ↓
             CP ────→    OG
          (FINAL)     (rework)
```

---

## 📊 Status Definitions

| Code | Name | Description | Color |
|------|------|-------------|-------|
| **OG** | On Going | Active work in progress | Blue |
| **WP** | Waiting Parts | Paused - parts unavailable | Orange |
| **QI** | Quality Inspection | Submitted for quality review | Purple |
| **HC** | Hold Customer | Waiting for customer | Yellow |
| **HW** | Hold Warranty | Waiting for warranty | Red |
| **HI** | Hold Insurance | Waiting for insurance | Indigo |
| **FR** | For Release | Approved and ready for customer | Green |
| **FU** | Finished Unclaimed | Completed but not picked up | Gray |
| **CP** | Complete | Released to customer (FINAL) | Emerald |

---

## 🎯 Step-by-Step Workflow

### **STAGE 1: Job Order Creation**

**Location:** `AddJobOrderModal` → `/api/job-orders` (POST)

**Input Required:**
- Job Number (unique)
- Vehicle: Plate Number, VIN
- Date & Time Range
- Assigned Technician
- Job List (tasks with status)
- Parts List (with availability)

**Automatic Logic:**
```typescript
if (ANY part is Unavailable) {
  status = 'WP'  // Waiting Parts
} else {
  status = 'OG'  // On Going
}
```

**Validations:**
- ✅ Job number uniqueness
- ✅ Technician exists and has role 'technician'
- ✅ Technician availability for time slot
- ✅ Break time automatically included in duration

**Result:** Job created with initial status

---

### **STAGE 2: Processing & Working**

**Locations:** `JobOrderCard`, `WorkshopTimetable`

**Available Actions:**

#### **2.1 Mark Tasks**
- Update individual job items to "Finished" or "Unfinished"
- Real-time progress tracking

#### **2.2 Update Parts**
- Change availability: "Available" or "Unavailable"
- **Auto-behavior:** If part set to Unavailable → status changes to WP

#### **2.3 Manual Status Changes**
Available transitions (validated by backend):
- **From OG:** → WP, QI, HC, HW, HI
- **From WP:** → OG, HC, HW, HI
- **From Hold (HC/HW/HI):** → OG, WP

#### **2.4 Reassign Technician**
- Checks availability for time slot
- Prevents double-booking

#### **2.5 Toggle Important**
- Mark jobs as priority with star indicator
- Important jobs appear first in lists

---

### **STAGE 3: Submit for Quality Inspection**

**Endpoint:** `PATCH /api/job-orders/:id/submit-qi`

**Requirements (Validated):**
- ✅ All tasks must be "Finished"
- ✅ All parts must be "Available"

**What Happens:**
```typescript
jobOrder.status = 'QI'
jobOrder.qiStatus = 'pending'
```

**UI Behavior:**
- Button disabled if requirements not met
- Error messages show what's missing
- Job appears in "Quality Inspection" section

---

### **STAGE 4: Quality Inspection Review**

**Display:** Two dedicated sections in Workshop Board

#### **4.1 Quality Inspection Section**
Shows jobs with: `status = 'QI'` AND `qiStatus = 'pending'`

**Actions Available:**

##### **APPROVE QI**
```typescript
Endpoint: PATCH /api/job-orders/:id/approve-qi
Result:
  status = 'FR'        // For Release
  qiStatus = 'approved'
```

##### **REJECT QI**
```typescript
Endpoint: PATCH /api/job-orders/:id/reject-qi
Result:
  status = 'OG'        // Back to On Going
  qiStatus = 'rejected'
```

#### **4.2 For Release Section**
Shows jobs with: `status = 'FR'`

**Actions Available:**

##### **COMPLETE (Release to Customer)**
```typescript
Endpoint: PATCH /api/job-orders/:id/complete
Result:
  status = 'CP'  // Complete (FINAL)
```
- Job removed from "For Release" list immediately
- Toast: "Job marked as Complete and released to customer"

##### **REDO (Send Back for Rework)**
```typescript
Endpoint: PATCH /api/job-orders/:id/redo
Result:
  status = 'OG'       // Back to On Going
  qiStatus = null     // Reset QI status
```

---

## 🔒 Status Transition Validation

**Backend enforces valid transitions:**

```typescript
VALID_STATUS_TRANSITIONS = {
  'OG': ['WP', 'QI', 'HC', 'HW', 'HI', 'OG'],
  'WP': ['OG', 'HC', 'HW', 'HI', 'WP'],
  'QI': ['FR', 'OG', 'QI'],
  'HC': ['OG', 'WP', 'HC'],
  'HW': ['OG', 'WP', 'HW'],
  'HI': ['OG', 'WP', 'HI'],
  'FR': ['FU', 'CP', 'OG', 'FR'],
  'FU': ['CP', 'FU'],
  'CP': ['CP']  // FINAL - no exit
}
```

**Invalid transitions return:**
```json
{
  "error": "Invalid status transition from OG to FR",
  "validTransitions": ["WP", "QI", "HC", "HW", "HI", "OG"]
}
```

---

## ✅ Production-Ready Fixes Applied

### **Fix 1: API URL Consistency** ✅
- **Problem:** Mixed use of `API_URL` and `API_BASE_URL`
- **Solution:** Standardized to `API_BASE_URL` across all routes
- **Files Updated:**
  - `/api/job-orders/[id]/complete/route.ts`
  - `/api/job-orders/[id]/redo/route.ts`

### **Fix 2: Parts Validation Before QI** ✅
- **Problem:** Jobs could be submitted to QI with missing parts
- **Solution:** Added validation in `submit-qi` endpoint
- **Backend:**
  ```typescript
  const allPartsAvailable = jobOrder.parts.every(
    part => part.availability === 'Available'
  )
  if (!allPartsAvailable) {
    return res.status(400).json({ 
      error: 'Cannot submit for QI: Not all parts are available' 
    })
  }
  ```
- **Frontend:** Button disabled + warning message if parts missing

### **Fix 3: Status Transition Validation** ✅
- **Problem:** No enforcement of valid state transitions
- **Solution:** Implemented state machine in backend
- **Features:**
  - Validates all status changes
  - Returns valid options on error
  - Frontend displays error messages

### **Fix 4: QI in Manual Status Dropdown** ✅
- **Problem:** QI status missing from manual change dropdown
- **Solution:** Added QI option to status dropdown
- **Note:** Can now manually set to QI (though submit-qi is recommended)

### **Fix 5: Next.js 15 Compatibility** ✅
- **Problem:** `params` not awaited (Next.js 15 requirement)
- **Solution:** Updated all route handlers to await params
- **Pattern:**
  ```typescript
  { params }: { params: Promise<{ id: string }> }
  const { id } = await params
  ```

---

## 🎨 UI/UX Features

### **Dashboard Overview**
- Statistics grid (Total, On Going, For Release, etc.)
- Anomaly detection (missing parts, overdue jobs, ready for QI)
- Carried over jobs requiring reassignment
- Important jobs highlight

### **Workshop Timetable**
- Visual timeline by technician
- 30-minute slots (7 AM - 6 PM)
- Color-coded job status
- Break time indicators
- Progress bars on job cards
- Click to view/edit job details

### **Job Order Management**
- Search by: Job Number, Plate, VIN, Technician Name
- Filter by status
- Pagination support
- Real-time updates

---

## 🔧 Technical Details

### **Authentication**
- JWT token-based authentication
- Role-based access control (RBAC)
- Roles: `administrator`, `job-controller`, `technician`

### **API Structure**
```
Backend:  http://localhost:4000
Routes:   /job-orders/*
Auth:     Bearer token + API key
```

### **Database**
- MongoDB with Mongoose
- Indexes on: status, date, technician, important, carriedOver, qiStatus

### **Frontend Stack**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- React Hot Toast

---

## 🚀 Key Benefits

1. **Data Integrity:** All transitions validated
2. **No Lost Parts:** Can't submit to QI without parts
3. **Clear Workflow:** Visual status tracking
4. **Audit Trail:** Timestamps and user tracking
5. **Conflict Prevention:** Technician double-booking prevented
6. **Break Time Handling:** Automatically calculated in schedules

---

## 📝 Notes

- **CP (Complete) is a final state** - no further transitions allowed
- **Break times stored in localStorage** - customizable per user/browser
- **Carried over jobs** - End-of-day process marks unfinished jobs
- **Important flag** - For priority jobs, shows star indicator
- **QI Status** - Tracks approval/rejection history

---

## 🔍 Error Handling

All endpoints return structured errors:
```json
{
  "error": "Description of what went wrong",
  "details": ["Additional info if available"]
}
```

Frontend displays user-friendly toast notifications.

---

**Last Updated:** $(date)
**Version:** 1.0.0
**Status:** Production Ready ✅


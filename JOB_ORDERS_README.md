# Job Orders System

This document describes the comprehensive job orders system implemented for the workshop board application.

## Overview

The job orders system allows users to create, manage, and track vehicle maintenance jobs with the following features:

- **Job Order Management**: Create, view, update, and delete job orders
- **Technician Assignment**: Assign jobs to available technicians with conflict checking
- **Status Tracking**: Track job progress (Incomplete, In Progress, Complete)
- **Time Management**: Set time ranges with automatic duration calculation
- **Parts Management**: Track parts availability and requirements
- **Job List Management**: Break down jobs into individual tasks with completion status

## Data Structure

### JobOrder Model

```typescript
interface JobOrder {
  _id: string
  jobNumber: string           // Unique identifier (e.g., "ABC0123")
  createdBy: User            // User who created the job order
  assignedTechnician: User   // Assigned technician
  plateNumber: string        // Vehicle plate number
  vin: string               // Vehicle identification number
  timeRange: {
    start: string          // Start time (e.g., "07:00")
    end: string            // End time (e.g., "12:00")
  }
  jobList: JobItem[]        // Array of job tasks
  parts: Part[]            // Array of required parts
  status: JobStatus        // Current status
  date: string            // Job date
  createdAt: string       // Creation timestamp
  updatedAt: string       // Last update timestamp
}

interface JobItem {
  description: string      // Task description
  status: 'Finished' | 'Unfinished'
}

interface Part {
  name: string            // Part name
  availability: 'Available' | 'Unavailable'
}

type JobStatus = 'Incomplete' | 'In Progress' | 'Complete'
```

## Sample Job Order

```json
{
  "jobNumber": "ABC0123",
  "createdBy": "Job Officer",
  "assignedTechnician": "Technician 2",
  "plateNumber": "ABC1234",
  "vin": "9238109232",
  "timeRange": {
    "start": "07:00",
    "end": "12:00"
  },
  "jobList": [
    { "description": "Oil Change", "status": "Finished" },
    { "description": "Air Filter Replacement", "status": "Finished" },
    { "description": "ATF Replacement", "status": "Unfinished" }
  ],
  "parts": [
    { "name": "4 Liter Oil 0W-20", "availability": "Available" },
    { "name": "Air Filter", "availability": "Available" },
    { "name": "3.8 Liter ATF", "availability": "Unavailable" }
  ],
  "status": "Incomplete"
}
```

## Backend API

### Endpoints

#### GET /job-orders
- **Description**: Fetch all job orders with optional filtering
- **Query Parameters**:
  - `status`: Filter by status (Incomplete, Complete, In Progress)
  - `technician`: Filter by assigned technician ID
  - `date`: Filter by specific date
- **Response**: Array of job orders with populated user data

#### POST /job-orders
- **Description**: Create a new job order
- **Body**: JobOrder creation data
- **Features**:
  - Automatic job number validation
  - Technician availability checking
  - Time conflict prevention

#### GET /job-orders/:id
- **Description**: Fetch a specific job order by ID
- **Response**: Single job order with populated user data

#### PUT /job-orders/:id
- **Description**: Update an existing job order
- **Body**: Partial job order data
- **Features**:
  - Technician availability re-checking
  - Time conflict prevention

#### DELETE /job-orders/:id
- **Description**: Delete a job order

#### GET /job-orders/technicians/available
- **Description**: Get available technicians for a specific time slot
- **Query Parameters**:
  - `date`: Job date
  - `startTime`: Start time
  - `endTime`: End time
- **Response**: Array of available technicians

### Business Logic

#### Technician Availability
- Technicians are considered unavailable if they have overlapping job orders
- Time conflicts are checked based on date and time range
- Only technicians with role "technician" are available for assignment

#### Time Range Validation
- Start time must be before end time
- Duration is automatically calculated and displayed
- Time conflicts are prevented when assigning technicians

#### Status Management
- **Incomplete**: New job orders start with this status
- **In Progress**: Can be set manually or automatically when work begins
- **Complete**: Final status when all work is finished

## Frontend Components

### Job Orders Page (`/dashboard/job-orders`)
- **Access**: All roles (administrator, job-controller, technician)
- **Features**:
  - Filter by status (All, Incomplete, In Progress, Complete)
  - Grid layout with job order cards
  - Real-time status updates
  - Add new job orders (restricted to admin/job-controller)

### Job Order Card
- **Displays**:
  - Job number and date
  - Vehicle information (plate, VIN)
  - Time range with duration
  - Assigned technician
  - Job list preview
  - Parts preview
  - Status with color coding
- **Actions**:
  - Start job (Incomplete → In Progress)
  - Complete job (In Progress → Complete)
  - Reopen job (Complete → Incomplete)

### Add Job Order Modal
- **Access**: Administrator and Job Controller only
- **Features**:
  - Form validation
  - Dynamic technician availability
  - Time range duration calculator
  - Dynamic job list and parts management
  - Real-time conflict checking

## Role-Based Access Control

### Administrator
- Full access to all job orders
- Can create, edit, and delete job orders
- Can view all technician assignments

### Job Controller
- Full access to all job orders
- Can create, edit, and delete job orders
- Can view all technician assignments

### Technician
- Can view all job orders
- Can update status of assigned jobs
- Cannot create or delete job orders
- Cannot reassign jobs to other technicians

## Time Management Features

### Duration Calculator
- Automatically calculates job duration based on start and end times
- Displays in hours and minutes format (e.g., "5h 0m")
- Updates in real-time as time range changes

### Conflict Prevention
- Prevents double-booking of technicians
- Checks for overlapping time ranges
- Validates time slot availability before assignment

## Database Indexes

The system includes optimized database indexes for:
- Status and date queries
- Technician assignment lookups
- Created by user queries
- Efficient filtering and sorting

## Error Handling

### Backend
- Comprehensive error messages for validation failures
- Conflict detection with descriptive messages
- Proper HTTP status codes

### Frontend
- User-friendly error messages
- Loading states for async operations
- Form validation with real-time feedback

## Future Enhancements

Potential improvements could include:
- Email notifications for status changes
- Advanced reporting and analytics
- Mobile app integration
- Barcode scanning for parts
- Photo attachments for job documentation
- Integration with inventory management
- Automated scheduling optimization

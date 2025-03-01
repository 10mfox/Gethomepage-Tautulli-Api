# API Documentation

## User Endpoints

### GET /api/users
Get all users with activity information.

**Query Parameters:**
- `search`: Filter users by name
- `start`: Pagination start index
- `length`: Number of records to return
- `order_column`: Column to sort by
- `order_dir`: Sort direction (asc/desc)

**Response:**
```json
{
  "response": {
    "result": "success",
    "data": [
      {
        "field": "User display information",
        "additionalfield": "Additional user information"
      }
    ],
    "recordsTotal": 10,
    "recordsFiltered": 5
  }
}
```

### GET /api/users/format-settings
Get user format settings.
### POST /api/users/format-settings
Update user format settings.
Media Endpoints
### GET /api/media/recent
Get recently added media from configured sections.
Query Parameters:

type: Filter by media type (movies, shows)
section: Filter by specific section IDs
count: Number of items to return per section

Response:
```json{
  "response": {
    "result": "success",
    "data": [
      {
        "field": "Media title information",
        "additionalfield": "Additional media information",
        "added_at": 1613145600,
        "media_type": "movies",
        "section_id": 1
      }
    ],
    "libraries": {
      "sections": [],
      "totals": {}
    }
  }
}
```
### GET /api/media/settings
Get media format settings.
### POST /api/media/settings
Update media format settings.
System Endpoints
### GET /api/health
Health check endpoint.
### GET /api/config
Get system configuration.
### POST /api/config
Update system configuration.
### POST /api/cache/clear
Clear system cache.
### POST /api/test-connection
Test Tautulli connection.
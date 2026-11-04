# Permission matrix

| Actor | Account | Shop drafts/settings | Inventory/fulfillment | Moderation | Users/access/settings |
|---|---|---|---|---|---|
| Visitor | Register/recover | No | No | No | No |
| Buyer | Own profile/orders/saved | Apply for shop | No | No | No |
| Owner | Own account | Own shops | Own shops | No | No |
| Staff | Own account | Explicit products/settings grant | Explicit inventory/orders grant | No | No |
| Moderator + MFA | Own account | Review submitted content | No | Assigned moderation queues | No |
| Admin + MFA | Own account | Review/manage shops | Authorized order intervention | Yes | Users/categories/reports |
| Super admin + MFA | Own account | Yes | Yes | Yes | Privileged role changes |

Roles are loaded from the database on every request. Membership permissions are checked per shop and resource. Public registration always creates a buyer. MFA is required on every privileged endpoint. Existing project administrator token is restricted to first-admin bootstrap; no public default credentials.

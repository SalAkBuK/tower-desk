Guide: Create Roles, Set Permissions, Apply Templates

Part A — Create a New Role

Open Permissions from the left sidebar (/admin/permissions).
In the “Create role” panel, fill in:
Role key (internal name, e.g. site_manager)
Role name (friendly label, e.g. “Site Manager”)
Optional description
Click Create role.
You should see the new role appear in the role dropdown.
Part B — Assign Permissions to That Role

On Permissions, select the new role in the Role dropdown.
Choose how you want to apply permissions:
Add: keep existing permissions and add more
Replace: overwrite with the new selection
Use the search + grouped list to find permissions.
You can Select group or Select visible to speed up.
Click Apply role permissions.
Tip: If you want to start from a known setup, select an existing role first, click Load current, then switch to your new role and hit Replace.

Part C — Apply Existing Role Templates (Use Another Role as a Template)

Go to Permissions (/admin/permissions).
Select an existing role you want to use as the template (e.g. “Manager”).
Click Load current to bring in its permissions.
Switch to the target role you want to configure.
Set mode to Replace, then click Apply role permissions.
This copies the template role’s permissions into the new role.

Part D — Assign Roles to a User

Go to User Access (/admin/access).
Select the user on the left list.
Expand the Roles section.
Check the role(s) you want.
Click Save roles.
Part E — Add Per‑User Overrides (Optional)

Still on User Access, open Permission overrides.
Choose Grant or Revoke.
Select the permissions (search/group list).
Click Apply overrides.
Overrides are user‑specific and override the role settings.

Common gotchas

If you can’t see the Permissions page, your account lacks roles.write.
If permissions don’t apply, ensure you clicked Apply role permissions or Apply overrides.
If you don’t see a permission in the list, you can add it via “Add custom key”.

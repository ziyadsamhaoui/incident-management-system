Here is the polished, highly structured prompt ready to send directly to your coding agent:

---

> **Refactoring Task: Chef d'atelier (Sous Chef) Interface Updates**
> Please update the **Chef d'atelier** role interface according to the following strict requirements:
> ### 1. Navigation & Views
>
>
> * **Sidebar:** Remove the "Dashboard" link entirely from the sidebar.
> * **Views Access:** Remove the "All Incidents" view completely. Architecture mandates that chefs d'atelier can only view incidents they have personally created ("My Incidents").
>
>
> ### 2. "My Incidents" Table Layout & Columns
>
>
> Rework the "My Incidents" interface to match the layout structure and styling elements from the reference specification below:
> * **Visual Structure Reference:**
> * A top control bar featuring a full-width search input on the left (*"Search by Incident ID..."*), followed by dropdown filters (*"All Status"*, *"All Types"*) and a *"More Filters"* button aligned to the right.
> * A clean data table underneath featuring a selection checkbox column, followed by structured columns: **Incident ID**, **Date/Time**, **Type** (rendered as colored pill badges, e.g., Safety, Accident, Complaint), **Status** (rendered as status badge pills, e.g., New, Under Review, Closed), and **Claimed By**.
>
>
> * **Column Adjustments:**
> * Completely **remove** the *"Employee"* and *"Actions"* columns.
> * Rename or map the *"Assigned To"* column to **"Claimed by"**, which maps directly to the **First Name** of the administrator who claimed the incident (refer to `workflow.md` logic).
>
>
>
>
> ### 3. Action Buttons (Create Incident)
>
>
> Add a create incident button with responsive layout behavior:
> * **Large Screens and Above:** Display `(+ Create Incident)` inside a slightly rounded blue box positioned at the bottom right.
> * **Medium Screens and Above:** Display only a compact `(+)` icon button inside a slightly rounded blue box.
>
>
> ### 4. Responsive Statistics Layout (Medium Screens and Lower)
>
>
> * Do not give each incident statistic its own individual full-width line.
> * Reorganize the statistics cards into a compact **2-column by 2-lines grid** layout (e.g., *Total Incidents* and *Open Incidents* share the first line, one in each column).
>
>
> ### 5. Welcome Transition Animation
>
>
> * Implement an initial introductory transition screen/overlay that appears when landing on the incidents view and smoothly fades out.
> * The overlay must dynamically welcome the user using their full name formatted as **[Last Name] [First Name]**.
>
>
> ### 6. Responsive Table & Toolbar Behavior (Medium Screens and Lower)
>
>
> * **Toolbar Split:** Split the top control bar line into **two distinct lines**:
> * *Line 1:* Search bar spanning the full width.
> * *Line 2:* Status filter, type filter, and "More Filters" button.
>
>
> * **Table Scrolling:** Make the "My Incidents" table container horizontally scrollable on medium screens and lower to preserve layout integrity.
>
>
> 
> 
-- 105: Public Portal RLS policies for unauthenticated access
-- Allows anon/public users to read published properties, media, and tours
-- Requires: 104_property_virtual_tours.sql (is_published columns)

-- Allow anon to read published units
CREATE POLICY "Enable read for anon on published units" ON units FOR SELECT TO anon
  USING (is_published = true);

-- Allow anon to read published property media
CREATE POLICY "Enable read for anon on published media" ON property_media FOR SELECT TO anon
  USING (is_published = true);

-- Allow anon to read published virtual tours
CREATE POLICY "Enable read for anon on published tours" ON virtual_tours FOR SELECT TO anon
  USING (is_published = true);

-- Allow anon to read active projects (for project names/locations)
CREATE POLICY "Enable read for anon on active projects" ON projects FOR SELECT TO anon
  USING (is_active = true);

-- Allow anon to read blocks (for building names)
CREATE POLICY "Enable read for anon on blocks" ON blocks FOR SELECT TO anon
  USING (true);

-- Allow anon to read floors (for floor plans)
CREATE POLICY "Enable read for anon on floors" ON floors FOR SELECT TO anon
  USING (true);

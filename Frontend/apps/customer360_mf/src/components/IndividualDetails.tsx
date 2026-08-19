import React from 'react';
import type { IndividualProfile, ContactDetail, FieldConfig } from '../types/api';
import { useFieldReveal } from '../hooks/useFieldReveal';
import DynamicProfileSection, { groupBySection } from './DynamicProfileSection';

interface IndividualDetailsProps {
  subTab: string;
  profile: IndividualProfile | null;
  contactInfo: ContactDetail | null;
  /** Field-visibility/masking config for the Individual profile — fetched once by Customer360.tsx
   * and passed down, same as `profile`/`contactInfo`. */
  fieldConfigs: FieldConfig[];
}

/** Which Sections (in FieldConfig) render under which of this page's four sub-tabs. Purely a
 * navigational grouping — the fields, labels, order, visibility, and masking within each Section
 * are entirely config-driven; this map only decides which existing tab a Section's cards appear
 * under, mirroring the tab structure this page already had. */
const SUBTAB_SECTIONS: Record<string, string[]> = {
  personal_details: ['Personal Details'],
  residency_contact_details: ['Residency Details', 'Contact Details'],
  employment_details: ['Employment Details'],
  additional_relationship_details: ['Additional Details', 'Referrer & Relationship Information'],
};

export default function IndividualDetails({ subTab, profile, contactInfo, fieldConfigs }: IndividualDetailsProps) {
  const { revealed, toggleReveal } = useFieldReveal({
    customerName: profile?.fullName || 'Unknown',
    customerType: 'Individual',
    customerId: profile?.nationalId || '',
  });

  if (!profile) return null;

  const sectionsForTab = SUBTAB_SECTIONS[subTab];
  if (!sectionsForTab) return null;

  const configsForTab = fieldConfigs
    .filter((f) => sectionsForTab.includes(f.section))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const grouped = groupBySection(configsForTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {grouped.map(({ section, fields }) => (
        <DynamicProfileSection
          key={section}
          section={section}
          fields={fields}
          profile={profile}
          contactInfo={contactInfo}
          revealed={revealed}
          onToggleReveal={toggleReveal}
        />
      ))}
    </div>
  );
}

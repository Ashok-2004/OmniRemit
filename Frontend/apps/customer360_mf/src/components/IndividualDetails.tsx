import React, { useState } from 'react';
import SectionContainer from './SectionContainer';
import {
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Globe,
  Shield,
  BookOpen,
  DollarSign,
  AlertTriangle,
  Hash,
  CreditCard,
  Building2,
  CheckSquare,
  TrendingUp,
  FileText,
  Briefcase,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { IndividualProfile, ContactDetail } from '../types/api';
import { maskPhone, maskNRIC, maskPassport, maskSecondaryID } from '../utils/masking';
import { api } from '../services/api';

interface IndividualDetailsProps {
  subTab: string;
  profile: IndividualProfile | null;
  contactInfo: ContactDetail | null;
}

export default function IndividualDetails({ subTab, profile, contactInfo }: IndividualDetailsProps) {
  if (!profile) return null;

  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const handleToggleReveal = async (fieldKey: string, fieldLabel: string, realVal: string) => {
    if (!realVal || realVal.trim() === '' || realVal.toLowerCase() === 'null') return;
    
    const isRevealing = !revealed[fieldKey];
    setRevealed(prev => ({ ...prev, [fieldKey]: isRevealing }));
    
    if (isRevealing) {
      try {
        await api.logAudit({
          action: "VIEW_SENSITIVE_DATA",
          customerName: profile.fullName || "Unknown",
          customerType: "Individual",
          field: fieldLabel,
          status: "Success",
          description: `Viewed ${fieldLabel} for customer '${profile.fullName || "Unknown"}'`,
          customerId: profile.nationalId || ""
        });
      } catch (err) {
        console.error("Failed to log view sensitive data audit:", err);
      }
    }
  };

  // Not a field the CRM's individual-profile contract actually returns (see
  // types/api.ts's IndividualProfile — deliberately not listed there so the
  // shared type stays honest about the real CRM contract). Referenced here
  // only because the existing UI already displayed it — always renders '-'
  // today, and this cast preserves that exact behavior rather than either
  // fabricating a CRM field or silently dropping the existing UI row.
  const vipTagging = (profile as IndividualProfile & { vipTagging?: string | null }).vipTagging;

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '-';
    const s = String(val).trim();
    if (s === '' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
      return '-';
    }
    return s;
  };

  const formatAddress = (val: unknown): string => {
    return formatValue(val);
  };

  return (
    <div>
      {/* 1. PERSONAL DETAILS */}
      {subTab === 'personal_details' && (
        <SectionContainer title="Personal Details" icon={<User size={16} />}>
          <div className="info-cards-grid">
            <div className="info-card">
              <div className="info-label">
                <User size={14} />
                Gender
              </div>
              <div className="info-value">{formatValue(profile.gender)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Calendar size={14} />
                Date of Birth
              </div>
              <div className="info-value">{formatValue(profile.birthDate)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <User size={14} />
                Race
              </div>
              <div className="info-value">{formatValue(profile.race)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Globe size={14} />
                Religion
              </div>
              <div className="info-value">{formatValue(profile.religion)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Shield size={14} />
                Bumi Status
              </div>
              <div className="info-value">{formatValue(profile.bumiStatus)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <BookOpen size={14} />
                Higher Education Level
              </div>
              <div className="info-value">{formatValue(profile.educationLevel)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <DollarSign size={14} />
                HNW Individual - Indicator
              </div>
              <div className="info-value">{formatValue(profile.hnwi)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <AlertTriangle size={14} />
                NRIC/Political Person
              </div>
              <div className="info-value">{formatValue(profile.pep)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <User size={14} />
                Marital Status
              </div>
              <div className="info-value">{formatValue(profile.status)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <User size={14} />
                Disability Status
              </div>
              <div className="info-value">{formatValue(profile.disabilityStatus)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Building2 size={14} />
                Customer Branch
              </div>
              <div className="info-value">{formatValue(profile.branch)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <CheckSquare size={14} />
                PDPA
              </div>
              <div className="info-value">{formatValue(profile.pdpaTag)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Hash size={14} />
                CIF
              </div>
              <div className="info-value">{formatValue(profile.phprId)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <CreditCard size={14} />
                Primary ID Number
              </div>
              <div className="info-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                <span style={{ wordBreak: 'break-all' }}>{revealed['nationalId'] ? formatValue(profile.nationalId) : maskNRIC(profile.nationalId)}</span>
                {profile.nationalId && profile.nationalId.trim() !== '' && profile.nationalId.toLowerCase() !== 'null' && (
                  <button
                    onClick={() => handleToggleReveal('nationalId', 'Primary ID Number', profile.nationalId!)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={revealed['nationalId'] ? 'Hide details' : 'Reveal details'}
                  >
                    {revealed['nationalId'] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <CreditCard size={14} />
                Secondary ID Number
              </div>
              <div className="info-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                <span style={{ wordBreak: 'break-all' }}>{revealed['oldId'] ? formatValue(profile.oldId) : maskSecondaryID(profile.oldId)}</span>
                {profile.oldId && profile.oldId.trim() !== '' && profile.oldId.toLowerCase() !== 'null' && (
                  <button
                    onClick={() => handleToggleReveal('oldId', 'Secondary ID Number', profile.oldId!)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={revealed['oldId'] ? 'Hide details' : 'Reveal details'}
                  >
                    {revealed['oldId'] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <CreditCard size={14} />
                Passport Number
              </div>
              <div className="info-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                <span style={{ wordBreak: 'break-all' }}>{revealed['passport'] ? formatValue(profile.passport) : maskPassport(profile.passport)}</span>
                {profile.passport && profile.passport.trim() !== '' && profile.passport.toLowerCase() !== 'null' && (
                  <button
                    onClick={() => handleToggleReveal('passport', 'Passport Number', profile.passport!)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={revealed['passport'] ? 'Hide details' : 'Reveal details'}
                  >
                    {revealed['passport'] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Phone size={14} />
                Phone Number
              </div>
              <div className="info-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                <span style={{ wordBreak: 'break-all' }}>{revealed['phonePersonal'] ? formatValue(contactInfo?.contactNumber) : maskPhone(contactInfo?.contactNumber)}</span>
                {contactInfo?.contactNumber && contactInfo.contactNumber.trim() !== '' && contactInfo.contactNumber.toLowerCase() !== 'null' && (
                  <button
                    onClick={() => handleToggleReveal('phonePersonal', 'Phone Number', contactInfo.contactNumber!)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={revealed['phonePersonal'] ? 'Hide details' : 'Reveal details'}
                  >
                    {revealed['phonePersonal'] ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Globe size={14} />
                Preferred Language
              </div>
              <div className="info-value">{formatValue(profile.languagePreferred)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <CheckSquare size={14} />
                MyBsn Active
              </div>
              <div className="info-value">{formatValue(profile.mybsnInd)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Shield size={14} />
                VIP Tagging
              </div>
              <div className="info-value vip-value-wrapper">
                {formatValue(vipTagging)}
                {String(vipTagging || '')
                  .toLowerCase()
                  .includes('yes') && <span className="vip-star">★</span>}
              </div>
            </div>
          </div>
        </SectionContainer>
      )}

      {/* 2. RESIDENCY & CONTACT DETAILS */}
      {subTab === 'residency_contact_details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* A. RESIDENCY DETAILS */}
          <SectionContainer title="Residency Details" icon={<MapPin size={16} />}>
            <div className="info-cards-grid">
              <div className="info-card">
                <div className="info-label">
                  <MapPin size={14} />
                  Place of Birth
                </div>
                <div className="info-value">{formatValue(profile.placeBirth)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Globe size={14} />
                  Citizenship
                </div>
                <div className="info-value">{formatValue(profile.citizenship)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Building2 size={14} />
                  Resident / Non Resident Indicator
                </div>
                <div className="info-value">{formatValue(profile.resdCode)}</div>
              </div>

              <div className="info-card full-width">
                <div className="info-label">
                  <MapPin size={14} />
                  Residency Address
                </div>
                <div className="info-value">{formatAddress(contactInfo?.fixedAddress)}</div>
              </div>
            </div>
          </SectionContainer>

          {/* B. CONTACT DETAILS */}
          <SectionContainer title="Contact Details" icon={<Phone size={16} />}>
            <div className="info-cards-grid">
              <div className="info-card">
                <div className="info-label">
                  <Mail size={14} />
                  Email
                </div>
                <div className="info-value">{formatValue(contactInfo?.padrEmail1)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Phone size={14} />
                  Phone
                </div>
                <div className="info-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                  <span style={{ wordBreak: 'break-all' }}>{revealed['phonePersonal'] ? formatValue(contactInfo?.contactNumber) : maskPhone(contactInfo?.contactNumber)}</span>
                  {contactInfo?.contactNumber && contactInfo.contactNumber.trim() !== '' && contactInfo.contactNumber.toLowerCase() !== 'null' && (
                    <button
                      onClick={() => handleToggleReveal('phonePersonal', 'Phone Number', contactInfo.contactNumber!)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#004EEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title={revealed['phonePersonal'] ? 'Hide details' : 'Reveal details'}
                    >
                      {revealed['phonePersonal'] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Mail size={14} />
                  Preferred Communication Channel
                </div>
                <div className="info-value">{formatValue(profile.preferComChnl)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Phone size={14} />
                  Marketing Message Opt-In/Out
                </div>
                <div className="info-value">{formatValue(profile.marketMessageOpt)}</div>
              </div>
            </div>
          </SectionContainer>
        </div>
      )}

      {/* 3. EMPLOYMENT DETAILS */}
      {subTab === 'employment_details' && (
        <SectionContainer title="Employment Details" icon={<Briefcase size={16} />}>
          <div className="info-cards-grid">
            <div className="info-card">
              <div className="info-label">
                <Briefcase size={14} />
                Employment Status
              </div>
              <div className="info-value">{formatValue(profile.jobStatus)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Building2 size={14} />
                Employer Company Name
              </div>
              <div className="info-value">{formatValue(profile.employerName)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Phone size={14} />
                Employer Phone
              </div>
              <div className="info-value">{formatValue(profile.employerPhone)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Mail size={14} />
                Employer Email
              </div>
              <div className="info-value">{formatValue(profile.employerEmail)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <CheckSquare size={14} />
                Payroll Indicator
              </div>
              <div className="info-value">{formatValue(profile.payrollInd)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <User size={14} />
                Designation
              </div>
              <div className="info-value">{formatValue(profile.designation)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Briefcase size={14} />
                Occupation
              </div>
              <div className="info-value">{formatValue(profile.occupation)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <Building2 size={14} />
                Industry
              </div>
              <div className="info-value">{formatValue(profile.industry)}</div>
            </div>

            <div className="info-card">
              <div className="info-label">
                <DollarSign size={14} />
                Income Range (Annual/Yearly)
              </div>
              <div className="info-value">{formatValue(profile.annualIncome)}</div>
            </div>

            <div className="info-card full-width">
              <div className="info-label">
                <MapPin size={14} />
                Employer Address
              </div>
              <div className="info-value">{formatAddress(profile.employerAddress)}</div>
            </div>
          </div>
        </SectionContainer>
      )}

      {/* 4. ADDITIONAL & RELATIONSHIP DETAILS */}
      {subTab === 'additional_relationship_details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* A. ADDITIONAL DETAILS */}
          <SectionContainer title="Additional Details" icon={<FileText size={16} />}>
            <div className="info-cards-grid">
              <div className="info-card">
                <div className="info-label">
                  <Calendar size={14} />
                  Customer Onboarding Date
                </div>
                <div className="info-value">{formatValue(profile.openingDate)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Calendar size={14} />
                  Turned Non-Resident On Date
                </div>
                <div className="info-value">{formatValue(profile.turnedNonResidentDate)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Calendar size={14} />
                  Last Contact Date
                </div>
                <div className="info-value">{formatValue(profile.lastContactDate)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Shield size={14} />
                  Customer Flags/Notes
                </div>
                <div className="info-value">{formatValue(profile.flags)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <TrendingUp size={14} />
                  Customer Segmentation
                </div>
                <div className="info-value">{formatValue(profile.segmentation)}</div>
              </div>
            </div>
          </SectionContainer>

          {/* B. REFERRER & RELATIONSHIP INFORMATION */}
          <SectionContainer title="Referrer & Relationship Information" icon={<User size={16} />}>
            <div className="info-cards-grid">
              <div className="info-card">
                <div className="info-label">
                  <User size={14} />
                  Referrer Employee Name
                </div>
                <div className="info-value">{formatValue(profile.refEmployeeName)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Mail size={14} />
                  Referrer Employee Email
                </div>
                <div className="info-value">{formatValue(profile.refEmployeeEmail)}</div>
              </div>

              <div className="info-card">
                <div className="info-label">
                  <Hash size={14} />
                  Referrer Employee ID
                </div>
                <div className="info-value">{formatValue(profile.refEmployeeId)}</div>
              </div>
            </div>
          </SectionContainer>
        </div>
      )}
    </div>
  );
}


'use client'

import React from 'react'
import Image from 'next/image'

export interface CompanyInfo {
  name: string
  address: string
  city: string
  postalCode: string
  country: string
  phone: string
  email: string
  website: string
  regNo: string
  gstNo: string
}

interface LetterheadProps {
  documentType: 'QUOTATION' | 'INVOICE' | 'PURCHASE_ORDER' | 'DELIVERY_ORDER' | 'JOB_COMPLETION' | 'RECEIPT'
  documentNumber: string
  documentDate: Date
  className?: string
  showCertifications?: boolean
}

const defaultCompanyInfo: CompanyInfo = {
  name: "AMPERE ENGINEERING PTE LTD",
  address: "101 Upper Cross Street, #04-05 People's Park Centre",
  city: "Singapore",
  postalCode: "058357",
  country: "Singapore",
  phone: "+65 6677 8457",
  email: "projects@ampere.com.sg",
  website: "www.ampereengineering.com.sg",
  regNo: "201021612W",
  gstNo: "201021612W"
}

export function DocumentLetterhead({ 
  documentType, 
  documentNumber, 
  documentDate,
  className = "",
  showCertifications = false 
}: LetterheadProps) {
  const company = defaultCompanyInfo

  const getDocumentTitle = (type: string) => {
    switch (type) {
      case 'QUOTATION': return 'QUOTATION'
      case 'INVOICE': return 'INVOICE'
      case 'PURCHASE_ORDER': return 'PURCHASE ORDER'
      case 'DELIVERY_ORDER': return 'DELIVERY ORDER'
      case 'JOB_COMPLETION': return 'JOB COMPLETION CERTIFICATE'
      case 'RECEIPT': return 'RECEIPT'
      default: return 'DOCUMENT'
    }
  }

  return (
    <div className={`letterhead-container ${className}`}>
      {/* Company Header */}
      <div className="letterhead-header">
        <div className="company-logo-section">
          <div className="logo-placeholder">
            <Image
              src="/branding/ampere-logo.png"
              alt="Ampere Engineering Logo"
              width={120}
              height={60}
              className="company-logo"
              priority
            />
          </div>
        </div>
        
        <div className="company-info-section">
          <h1 className="company-name">{company.name}</h1>
          <div className="company-tagline">Professional Engineering Solutions</div>
          <div className="company-details">
            <div className="detail-line">{company.address}, {company.city} {company.postalCode}</div>
            <div className="contact-line">
              <span>email: {company.email}</span>
              <span className="separator">|</span>
              <span>tel: {company.phone}</span>
            </div>
            <div className="contact-line">
              <span>Business/GST Registration No: {company.regNo}</span>
            </div>
          </div>
        </div>

        <div className="company-certs-section">
          {showCertifications && (
            <div className="certifications">
              <div className="cert-item">
                <div className="cert-badge">ISO</div>
                <div className="cert-text">9001:2015</div>
              </div>
              <div className="cert-item">
                <div className="cert-badge">BIZSAFE</div>
                <div className="cert-text">Level 3</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decorative line */}
      <div className="letterhead-divider">
        <div className="divider-line primary"></div>
        <div className="divider-line secondary"></div>
      </div>

      {/* Document Title Section */}
      <div className="document-header">
        <div className="document-title-section">
          <h2 className="document-title">{getDocumentTitle(documentType)}</h2>
          <div className="document-meta">
            <div className="document-number">Document No: <span className="emphasis">{documentNumber}</span></div>
            <div className="document-date">Date: <span className="emphasis">{documentDate.toLocaleDateString('en-SG')}</span></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .letterhead-container {
          background: white;
          padding: 0;
          margin: 0;
          font-family: 'Arial', 'Helvetica', sans-serif;
          color: #333;
          width: 100%;
          max-width: 210mm; /* A4 width */
        }

        .letterhead-header {
          display: flex;
          align-items: flex-start;
          padding: 20px 0;
          min-height: 120px;
        }

        .company-logo-section {
          width: 120px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-right: 20px;
        }

        .logo-placeholder {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 10px;
        }

        .company-logo {
          max-width: 100%;
          height: auto;
          object-fit: contain;
        }

        .company-info-section {
          flex: 1;
          padding: 0 20px;
        }

        .company-name {
          font-size: 28px;
          font-weight: bold;
          color: #dc2626;
          margin: 0 0 4px 0;
          letter-spacing: 1px;
        }

        .company-tagline {
          font-size: 14px;
          color: #666;
          font-style: italic;
          margin-bottom: 12px;
        }

        .company-details {
          font-size: 12px;
          line-height: 1.4;
        }

        .detail-line {
          margin-bottom: 3px;
          color: #555;
        }

        .contact-line {
          margin-bottom: 3px;
          color: #555;
        }

        .separator {
          margin: 0 8px;
          color: #ccc;
        }

        .company-certs-section {
          width: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .certifications {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .cert-item {
          text-align: center;
          border: 1px solid #dc2626;
          border-radius: 4px;
          padding: 4px;
          background: white;
        }

        .cert-badge {
          font-size: 10px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 1px;
        }

        .cert-text {
          font-size: 8px;
          color: #666;
        }

        .letterhead-divider {
          margin: 10px 0 20px 0;
        }

        .divider-line {
          height: 2px;
          width: 100%;
          margin-bottom: 2px;
        }

        .divider-line.primary {
          background: #dc2626;
        }

        .divider-line.secondary {
          background: #f3f4f6;
        }

        .document-header {
          margin-bottom: 30px;
        }

        .document-title-section {
          text-align: center;
          padding: 15px 0;
          border: 2px solid #dc2626;
          background: #fefefe;
        }

        .document-title {
          font-size: 24px;
          font-weight: bold;
          color: #dc2626;
          margin: 0 0 10px 0;
          letter-spacing: 2px;
        }

        .document-meta {
          display: flex;
          justify-content: center;
          gap: 40px;
          font-size: 14px;
          color: #555;
        }

        .emphasis {
          font-weight: bold;
          color: #dc2626;
        }

        /* Print styles */
        @media print {
          .letterhead-container {
            margin: 0;
            padding: 0;
            box-shadow: none;
          }
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .letterhead-header {
            flex-direction: column;
            text-align: center;
          }
          
          .company-logo-section,
          .company-certs-section {
            width: 100%;
            padding: 10px 0;
          }
          
          .company-info-section {
            padding: 10px 0;
          }
          
          .document-meta {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  )
}

export function DocumentFooter({ className = "", showCertifications = true }: { className?: string, showCertifications?: boolean }) {
  const company = defaultCompanyInfo

  return (
    <div className={`document-footer ${className}`}>
      {/* Footer divider */}
      <div className="footer-divider">
        <div className="divider-line secondary"></div>
        <div className="divider-line primary"></div>
      </div>

      {/* Footer content */}
      <div className="footer-content">
        <div className="footer-section">
          <div className="footer-company">{company.name}</div>
          <div className="footer-tagline">Your Trusted Engineering Partner</div>
        </div>
        
        {showCertifications && (
          <div className="footer-certifications">
            <div className="cert-images-grid">
              <div className="cert-image-container">
                <Image
                  src="/branding/bizsafe-star.jpg"
                  alt="BizSafe Star Certification"
                  width={80}
                  height={50}
                  className="cert-image"
                />
              </div>
              <div className="cert-image-container">
                <Image
                  src="/branding/iso-45001.jpg"
                  alt="ISO 45001 Certification"
                  width={120}
                  height={50}
                  className="cert-image"
                />
              </div>
            </div>
          </div>
        )}
        
        <div className="footer-disclaimer">
          <p>This document is computer generated and does not require a signature.</p>
          <p>All prices are in Singapore Dollars unless otherwise stated.</p>
        </div>
      </div>

      <style jsx>{`
        .document-footer {
          margin-top: 40px;
          padding-top: 20px;
          font-family: 'Arial', 'Helvetica', sans-serif;
          color: #666;
          width: 100%;
          max-width: 210mm;
        }

        .footer-divider {
          margin-bottom: 20px;
        }

        .divider-line {
          height: 1px;
          width: 100%;
          margin-bottom: 2px;
        }

        .divider-line.primary {
          background: #dc2626;
        }

        .divider-line.secondary {
          background: #e5e7eb;
        }

        .footer-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .footer-section {
          text-align: center;
        }

        .footer-company {
          font-size: 16px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 4px;
        }

        .footer-tagline {
          font-size: 12px;
          color: #888;
          font-style: italic;
        }

        .footer-certifications {
          text-align: center;
        }

        .cert-images-grid {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }

        .cert-image-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 5px;
          background: white;
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .cert-image {
          max-width: 100%;
          height: auto;
          object-fit: contain;
        }

        .footer-disclaimer {
          text-align: center;
          font-size: 10px;
          color: #999;
          line-height: 1.3;
        }

        .footer-disclaimer p {
          margin: 2px 0;
        }

        /* Print styles */
        @media print {
          .document-footer {
            page-break-inside: avoid;
          }
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .cert-images-grid {
            flex-direction: column;
            align-items: center;
            gap: 15px;
          }
        }
      `}</style>
    </div>
  )
}

// Export types for use in other components
export type DocumentType = 'QUOTATION' | 'INVOICE' | 'PURCHASE_ORDER' | 'DELIVERY_ORDER' | 'JOB_COMPLETION' | 'RECEIPT'

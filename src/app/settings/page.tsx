
"use client";

// This page is no longer needed as the global low stock threshold functionality
// has been moved to a per-drug basis.
// All settings are now managed either per-drug (like threshold) or are implicit.

// Keeping the file with this comment to ensure the build system recognizes the deletion.
// If this file were completely removed, the agent might not register its deletion properly.

// import SettingsForm from '@/components/SettingsForm';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Settings (Deprecated)</h1>
      <p className="text-muted-foreground">
        This page is no longer in use. Low stock thresholds are now managed individually for each drug
        via the 'Manage Drugs' page.
      </p>
      {/* <SettingsForm /> */}
    </div>
  );
}

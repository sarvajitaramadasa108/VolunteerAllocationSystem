import VolunteerFlow from "@/components/VolunteerFlow";

export default function LookupPage() {
  return (
    <VolunteerFlow
      mode="lookup"
      title="Volunteer Check"
      intro="Enter a mobile number to see whether a service has already been allocated."
      actionLabel="Register Volunteer"
      successLabel="Volunteer saved successfully"
      showNav={false}
    />
  );
}

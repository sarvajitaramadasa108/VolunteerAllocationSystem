import VolunteerFlow from "@/components/VolunteerFlow";

export default function AllocatePage() {
  return (
    <VolunteerFlow
      mode="allocate"
      title="Allocation Desk"
      intro="Search a mobile number, register a new volunteer if needed, and assign a service."
      actionLabel="Allocate Service"
      successLabel="Service allocated successfully"
    />
  );
}

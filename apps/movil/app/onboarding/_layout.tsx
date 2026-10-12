import { Stack } from 'expo-router';

/** Onboarding O1–O7 (`02 §3`). Cada paso guarda al continuar; el consentimiento va antes de cualquier dato. */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

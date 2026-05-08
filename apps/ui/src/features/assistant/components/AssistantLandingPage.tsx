import { AssistantLandingView } from "#features/assistant/components/AssistantLandingView.tsx";
import { useCoffeeAssistant } from "#features/assistant/hooks/useCoffeeAssistant.ts";
import { useThemePreference } from "#shared/hooks/useThemePreference.ts";

export function AssistantLandingPage() {
  const assistant = useCoffeeAssistant();
  const { theme, toggleTheme } = useThemePreference();

  return (
    <AssistantLandingView
      connectionStatus={assistant.connectionStatus}
      errorMessage={assistant.errorMessage}
      events={assistant.events}
      input={assistant.input}
      isBusy={assistant.isBusy}
      messages={assistant.messages}
      prompts={assistant.prompts}
      status={assistant.status}
      theme={theme}
      onInputChange={assistant.setInput}
      onPromptClick={(prompt) => void assistant.submit(prompt)}
      onReset={assistant.resetConversation}
      onSubmit={() => void assistant.submit()}
      onToggleTheme={toggleTheme}
    />
  );
}

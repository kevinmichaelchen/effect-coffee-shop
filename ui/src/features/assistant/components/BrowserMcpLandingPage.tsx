import { BrowserMcpLandingView } from "#features/assistant/components/BrowserMcpLandingView.tsx";
import { useLfmCoffeeAssistant } from "#features/assistant/hooks/useLfmCoffeeAssistant.ts";
import { useThemePreference } from "#shared/hooks/useThemePreference.ts";

export function BrowserMcpLandingPage() {
  const assistant = useLfmCoffeeAssistant();
  const { theme, toggleTheme } = useThemePreference();

  return (
    <BrowserMcpLandingView
      assistantDraft={assistant.assistantDraft}
      cacheStatus={assistant.cacheStatus}
      errorMessage={assistant.errorMessage}
      events={assistant.events}
      hasLoadedModel={assistant.hasLoadedModel}
      input={assistant.input}
      isBusy={assistant.isBusy}
      messages={assistant.messages}
      prompts={assistant.prompts}
      status={assistant.status}
      theme={theme}
      onInputChange={assistant.setInput}
      onPromptClick={(prompt) => assistant.submit(prompt)}
      onReset={assistant.resetConversation}
      onSubmit={() => assistant.submit()}
      onToggleTheme={toggleTheme}
      onWarmUp={() => assistant.warmUp()}
    />
  );
}

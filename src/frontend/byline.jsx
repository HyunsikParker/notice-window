import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Heading, Inline, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { DaysLozenge, actBy, termLine } from './common.jsx';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { invoke('getPageData').then(setData).catch((e) => setError(String(e))); }, []);
  if (error) return <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>;
  if (!data) return <Spinner label="Reading the contract" />;
  const c = data.contract;
  if (!c) {
    return (
      <Stack space="space.100">
        <Text>This page has no contract terms.</Text>
        <Text>Add a page properties table with Counterparty, Owner, Start date, Initial term, Renewal, Notice period and Annual value rows.</Text>
      </Stack>
    );
  }
  return (
    <Stack space="space.150">
      <Inline space="space.100" alignBlock="center">
        <Heading size="small">{actBy(c)}</Heading>
        <DaysLozenge c={c} />
      </Inline>
      {termLine(c) && <Text>{termLine(c)}</Text>}
      {c.rule && <Text>{c.rule}</Text>}
      {c.findings.length > 0 && (
        <SectionMessage appearance="warning" title="Check this page">
          {c.findings.map((f) => <Text key={f}>{f}</Text>)}
        </SectionMessage>
      )}
    </Stack>
  );
}

ForgeReconciler.render(<React.StrictMode><App /></React.StrictMode>);

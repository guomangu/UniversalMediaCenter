import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { searchCatalog } from '@/services/api';
import { TagPill } from './TagPill';
import { styles } from './SearchBar.styles';

export const SearchBar: React.FC = () => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ nodes: any[]; tags: any[]; people: any[] }>({
    nodes: [],
    tags: [],
    people: [],
  });
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<any>(null);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleSearch = (text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setIsOpen(false);
      setResults({ nodes: [], tags: [], people: [] });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const data = await searchCatalog(text.trim());
      setResults({
        nodes: Array.isArray(data?.nodes) ? data.nodes : [],
        tags: Array.isArray(data?.tags) ? data.tags : [],
        people: Array.isArray(data?.people) ? data.people : [],
      });
      setIsOpen(true);
    }, 180);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Recherche instantanée (titre, acteur, genre, 4K, CSA)..."
        placeholderTextColor="#64748b"
        value={query}
        onChangeText={handleSearch}
        returnKeyType="search"
      />
      {isOpen && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {results.people.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Personnes</Text>
                {results.people.slice(0, 5).map((person: any) => (
                  <Pressable
                    key={`person-${person.slug}-${person.role || ''}`}
                    focusable={true}
                    style={styles.resultRow}
                    onPress={() => {
                      setIsOpen(false);
                      router.push({
                        pathname: '/person/[slug]',
                        params: { slug: person.slug, name: person.name, role: person.role || '' },
                      } as any);
                    }}
                  >
                    <Text style={styles.resultTitle}>{person.name}</Text>
                    <Text style={styles.resultSub}>{person.role || 'Personne'}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {results.tags.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags & Filtres</Text>
                <View style={styles.tagWrap}>
                  {results.tags.map((t: any) => (
                    <TagPill
                      key={`${t.slug || t.label}-${t.category || ''}`}
                      label={t.label}
                      subtext={t.category}
                      theme="indigo"
                      onPress={() => {
                        setIsOpen(false);
                        router.push({
                          pathname: '/explore',
                          params: { tag: t.slug, label: t.label },
                        } as any);
                      }}
                    />
                  ))}
                </View>
              </View>
            )}
            {results.nodes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Médias ({results.nodes.length})</Text>
                {results.nodes.slice(0, 5).map((node: any) => (
                  <Pressable
                    key={node.id}
                    focusable={true}
                    style={styles.resultRow}
                    onPress={() => {
                      setIsOpen(false);
                      router.push(`/media/${node.id}` as any);
                    }}>
                    <Text style={styles.resultTitle}>{node.title}</Text>
                    <Text style={styles.resultSub}>{node.releaseYear || node.nodeType}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {results.tags.length === 0 && results.people.length === 0 && results.nodes.length === 0 && (
              <Text style={styles.emptyResult}>Aucun résultat pour « {query.trim()} »</Text>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

import React, { useState } from 'react';
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

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length >= 2) {
      const data = await searchCatalog(text);
      setResults(data);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Recherche instantanée (titre, acteur, genre, 4K, CSA)..."
        placeholderTextColor="#64748b"
        value={query}
        onChangeText={handleSearch}
      />
      {isOpen && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.scroll}>
            {results.tags.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags & Filtres</Text>
                <View style={styles.tagWrap}>
                  {results.tags.map((t) => (
                    <TagPill
                      key={t.id}
                      label={t.value_text}
                      theme={t.color_theme || 'indigo'}
                      onPress={() => {
                        setIsOpen(false);
                        router.push(`/explore?tag=${t.value_slug}`);
                      }}
                    />
                  ))}
                </View>
              </View>
            )}
            {results.nodes.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Médias ({results.nodes.length})</Text>
                {results.nodes.slice(0, 5).map((node) => (
                  <Pressable
                    key={node.id}
                    style={styles.resultRow}
                    onPress={() => {
                      setIsOpen(false);
                      router.push(`/media/${node.id}` as any);
                    }}>
                    <Text style={styles.resultTitle}>{node.title}</Text>
                    <Text style={styles.resultSub}>{node.release_year || node.node_type}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

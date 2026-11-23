import { ScrollView, View } from 'react-native';
import ProfileChildren from '../../components/profile-children';
import { useProfileLayout } from '../../components/profile-layout';
import { useAppSelector } from '../../store';
import { canAddChild } from '../../utils/child-requests';

export default function MyChildrenScreen() {
  const layout = useProfileLayout();
  const role = useAppSelector(state => state.auth.user?.role);
  if (!canAddChild(role)) return null;
  return (
    <ScrollView style={layout.screen} contentContainerStyle={layout.content}>
      <View style={layout.block}><ProfileChildren compact /></View>
    </ScrollView>
  );
}

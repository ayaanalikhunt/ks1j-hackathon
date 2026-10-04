import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { Image, Linking } from "react-native";
import {
  MOSQUES,
  buildGoogleMapsUrl,
  extractMosqueQuery,
  findNearbyShiaMosques,
  hasVerifiedPin,
  isApproximatePin,
  isFriday,
  searchFriday,
  searchMosques,
  type MosqueVenue,
  type UserLocation,
} from "@ks1j/shared";
import { Banner, Body, Btn, Card, Chip, Field, Heading, Screen } from "@/components/ui";
import { useCollection } from "@/lib/firestore";
import { useLang } from "@/lib/i18n";

type Row = { id: string } & Partial<MosqueVenue>;

function Venue({ m, km }: { m: MosqueVenue; km?: number | null }) {
  const { t } = useLang();
  const pin = hasVerifiedPin(m);
  const verified = m.verificationStatus === "VOLUNTEER_VERIFIED" || m.verificationStatus === "OFFICIALLY_VERIFIED";
  return (
    <Card>
      <Heading>{m.name}</Heading>
      {m.photoUrl ? (
        <Image source={{ uri: m.photoUrl }} accessibilityLabel={t("mq.photoOf", { name: m.name })} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }} resizeMode="cover" />
      ) : (
        <Body muted>{t("mq.noPhoto")}</Body>
      )}
      <Body muted>{`${m.type} · ${m.area}, ${m.city}`}</Body>
      <Body bold>{verified ? t("mq.verified") : t("mq.pending")}</Body>
      <Body>{m.address}</Body>
      {typeof km === "number" && <Body bold>{t("mq.away", { km: km.toFixed(1) })}</Body>}
      <Body>{t(`mq.j.${m.jummahStatus}` as "mq.j.YES")}</Body>
      {m.jummahSchedules?.filter((s) => s.status === "VERIFIED").map((s) => <Body key={s.time} bold>{t("mq.fridayAt", { time: s.time })}</Body>)}
      {m.phone ? <Btn quiet label={m.phone} onPress={() => Linking.openURL(`tel:${m.phone!.replace(/\s+/g, "")}`)} /> : null}
      <Btn label={pin && !isApproximatePin(m) ? t("mq.openMaps") : t("mq.searchAddress")} onPress={() => Linking.openURL(buildGoogleMapsUrl(m))} />
      {!pin && <Body muted>{t("mq.pinUnchecked")}</Body>}
      {pin && isApproximatePin(m) ? <Body muted>{t("mq.approxPin")}</Body> : null}
    </Card>
  );
}

export default function Mosques() {
  const { t } = useLang();
  const live = useCollection("mosques", [], []);
  const mosques: MosqueVenue[] = live.rows.length ? (live.rows as Row[]).map((r) => ({ ...(r as MosqueVenue) })) : MOSQUES;

  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [loc, setLoc] = useState<UserLocation | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [friday, setFriday] = useState(() => isFriday());
  const [more, setMore] = useState(false);

  const parsed = useMemo(() => extractMosqueQuery(submitted), [submitted]);
  const wantsFriday = friday || parsed.intent === "FIND_NEAREST_FRIDAY_MASJID";
  const matches = useMemo(() => searchMosques(parsed, mosques), [parsed, mosques]);
  const nearby = useMemo(() => (loc ? findNearbyShiaMosques(loc, matches) : []), [loc, matches]);
  const fri = useMemo(() => searchFriday(loc, matches), [loc, matches]);

  async function useLocation() {
    setLocMsg(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return setLocMsg(t("mq.locDenied"));
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLoc({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeters: p.coords.accuracy ?? undefined });
    } catch {
      setLocMsg(t("mq.locFailed"));
    }
  }

  const list: { m: MosqueVenue; km?: number | null }[] = wantsFriday
    ? fri.confirmed.map((r) => ({ m: r.mosque, km: r.distanceKm }))
    : loc && parsed.intent === "FIND_NEARBY_SHIA_MASJID" && nearby.length
      ? nearby.map((r) => ({ m: r.mosque, km: r.distanceKm }))
      : matches.map((m) => ({ m }));
  const fallback = wantsFriday && !fri.confirmed.length ? [...fri.likely, ...(more ? fri.unconfirmed : [])].map((c) => ({ m: c.mosque, km: c.distanceKm })) : [];

  return (
    <Screen eyebrow={t("mq.eyebrow")} title={t("mq.title")} intro={t("mq.intro")}>
      <Field label={t("mq.search")} value={text} onChangeText={setText} returnKeyType="search" onSubmitEditing={() => setSubmitted(text)} />
      <Btn label={t("mq.searchBtn")} onPress={() => setSubmitted(text)} />
      <Btn quiet label={t("mq.useLoc")} onPress={useLocation} />
      <Chip label={t("mq.friday")} on={friday} onPress={() => setFriday(!friday)} />
      {locMsg ? <Banner error>{locMsg}</Banner> : null}
      {loc ? <Banner>{t("mq.straight")}</Banner> : null}
      {wantsFriday ? <Banner>{t("mq.fridayNote")}</Banner> : null}
      {wantsFriday && !fri.confirmed.length ? (
        <Card>
          <Heading>{t("mq.noFriday")}</Heading>
          <Btn quiet label={t("mq.showMore")} onPress={() => setMore(true)} />
        </Card>
      ) : null}
      {[...list, ...fallback].map(({ m, km }) => <Venue key={m.id} m={m} km={km} />)}
      {!list.length && !fallback.length && !wantsFriday ? <Banner>{t("mq.nothing")}</Banner> : null}
    </Screen>
  );
}

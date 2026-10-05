import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { Image, Linking } from "react-native";
import {
  MOSQUES,
  buildGoogleMapsUrl,
  extractMosqueQuery,
  nearestFirst,
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

const LOCATION_TIMEOUT_MS = 15000;

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
  // once a location is known, nearest first, whether or not the search said "near"
  const ranked = useMemo(() => nearestFirst(loc, matches), [loc, matches]);
  const fri = useMemo(() => searchFriday(loc, matches), [loc, matches]);

  async function locate() {
    setLocMsg(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return setLocMsg(t("mq.locDenied"));
      if (!(await Location.hasServicesEnabledAsync())) return setLocMsg(t("mq.locFailed"));
      // a fresh fix can hang indoors or with location just switched on; fall back to the last known one
      const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS));
      const p = (await Promise.race([fresh, timeout])) ?? (await Location.getLastKnownPositionAsync());
      if (!p) return setLocMsg(t("mq.locFailed"));
      setLoc({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyMeters: p.coords.accuracy ?? undefined });
    } catch {
      setLocMsg(t("mq.locFailed"));
    }
  }

  // "nearest masjid", "jummah near me": ask for the location the search needs
  function submit() {
    setSubmitted(text);
    if (!loc && extractMosqueQuery(text).requiresLocation) void locate();
  }

  const list: { m: MosqueVenue; km?: number | null }[] = wantsFriday
    ? fri.confirmed.map((r) => ({ m: r.mosque, km: r.distanceKm }))
    : ranked.map((r) => ({ m: r.mosque, km: r.distanceKm }));
  const fallback = wantsFriday && !fri.confirmed.length ? [...fri.likely, ...(more ? fri.unconfirmed : [])].map((c) => ({ m: c.mosque, km: c.distanceKm })) : [];

  return (
    <Screen eyebrow={t("mq.eyebrow")} title={t("mq.title")} intro={t("mq.intro")}>
      <Field label={t("mq.search")} value={text} onChangeText={setText} returnKeyType="search" onSubmitEditing={submit} />
      <Btn label={t("mq.searchBtn")} onPress={submit} />
      <Btn quiet label={t("mq.useLoc")} onPress={locate} />
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

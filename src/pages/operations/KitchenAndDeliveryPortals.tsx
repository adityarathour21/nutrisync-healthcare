import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  ChefHat,
  ClipboardList,
  MapPin,
  Navigation,
  ShieldAlert,
  Truck,
  Wallet,
} from 'lucide-react';
import { PortalLayout, PortalNavItem } from '../../layouts/PortalLayout';
import { useApp } from '../../context/AppContext';
import { api, getApiErrorMessage } from '../../services/api';
import { DeliveryRouteMap } from '../../components/maps/NutriSyncMaps';

// ==========================================
// 1. CHEF & CLINICAL KITCHEN PORTAL (PHI-MINIMIZED)
// ==========================================
interface SanitizedKitchenOrder {
  id: string;
  orderNumber: string;
  scheduledSlot: string;
  status: 'confirmed' | 'preparing' | 'quality_checked' | 'ready_for_dispatch';
  items: {
    mealId: string;
    mealName: string;
    quantity: number;
    portionSize: string;
    calories: number;
    sodium: number;
    allergens: string[];
  }[];
  patientAllergenWarnings: string[];
  qualityChecklist: {
    portionWeighed: boolean;
    allergenCrossCheck: boolean;
    sodiumVerified: boolean;
    tamperSealApplied: boolean;
  };
}

interface KitchenRecipe {
  id: string;
  name: string;
  portionSize: string;
  prepTimeMins: number;
  ingredients: string[];
  allergens: string[];
  sodium: number;
  calories: number;
  recipeSteps: string[];
}

interface InventoryRow {
  id: string;
  ingredientName: string;
  category: string;
  unit: string;
  stockQty: number;
  reorderThreshold: number;
  allergenGroup: string;
  lastUpdatedBy: string;
}

export const KitchenPortal: React.FC = () => {
  const { pushToast, realtimeTick } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'kds';
  const setTab = (tab: string) => setSearchParams({ tab });

  const [orders, setOrders] = useState<SanitizedKitchenOrder[]>([]);
  const [recipes, setRecipes] = useState<KitchenRecipe[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [approvedPlansCount, setApprovedPlansCount] = useState(0);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});

  const fetchKitchen = useCallback(async () => {
    try {
      const { data } = await api.get('/kitchen/dashboard');
      setOrders(data.orders || []);
      setRecipes(data.recipes || []);
      setInventory(data.inventory || []);
      setApprovedPlansCount(data.approvedPlansCount || 0);
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Failed to load Kitchen Display System'), 'error');
    }
  }, [pushToast]);

  useEffect(() => {
    void fetchKitchen();
  }, [fetchKitchen, realtimeTick]);

  const lowStockCount = inventory.filter((i) => i.stockQty <= i.reorderThreshold).length;

  const navItems: PortalNavItem[] = [
    { id: 'kds', label: 'Kitchen Prep Queue', icon: <ChefHat className="w-4 h-4" />, count: orders.length },
    { id: 'recipes', label: 'Clinical Recipe SOPs', icon: <ClipboardList className="w-4 h-4" />, count: recipes.length },
    { id: 'inventory', label: 'Ingredient Inventory', icon: <Boxes className="w-4 h-4" />, count: lowStockCount },
  ];

  const toggleQcCheck = async (
    order: SanitizedKitchenOrder,
    field: keyof SanitizedKitchenOrder['qualityChecklist']
  ) => {
    const updatedChecklist = {
      ...order.qualityChecklist,
      [field]: !order.qualityChecklist[field],
    };
    try {
      await api.put(`/kitchen/orders/${order.id}/status`, {
        qualityChecklist: updatedChecklist,
      });
      await fetchKitchen();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const advanceOrderStatus = async (
    orderId: string,
    status: 'preparing' | 'quality_checked' | 'ready_for_dispatch'
  ) => {
    try {
      await api.put(`/kitchen/orders/${orderId}/status`, { status });
      pushToast(`Order moved to ${status.replace(/_/g, ' ')}`, 'success');
      await fetchKitchen();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const handleUpdateStock = async (item: InventoryRow) => {
    const nextQty = stockEdits[item.id] ?? item.stockQty;
    try {
      await api.put(`/kitchen/inventory/${item.id}`, { stockQty: nextQty });
      pushToast(`Updated ${item.ingredientName} stock`, 'success');
      await fetchKitchen();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  return (
    <PortalLayout
      roleTitle="Chef & Clinical Kitchen KDS"
      subtitle={`PHI-Minimized Workspace · ${approvedPlansCount} active dietitian protocols · Zero medical diagnosis exposure`}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setTab}
    >
      {activeTab === 'kds' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              <strong>HIPAA/Clinical Data Minimization Active:</strong> Patient names, diagnoses, and prescriptions are stripped before kitchen transmission. Follow portion weights and allergen warnings strictly.
            </span>
            <span className="font-mono font-semibold text-slate-900">
              Active Tickets: {orders.length}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              All clinical meal tickets have been dispatched.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {orders.map((o) => {
                const allChecksPassed =
                  o.qualityChecklist.portionWeighed &&
                  o.qualityChecklist.allergenCrossCheck &&
                  o.qualityChecklist.sodiumVerified &&
                  o.qualityChecklist.tamperSealApplied;

                return (
                  <div
                    key={o.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold font-mono text-slate-900">
                            Ticket {o.orderNumber}
                          </h3>
                          <p className="text-xs font-mono text-slate-500">
                            Dispatch Slot: {o.scheduledSlot}
                          </p>
                        </div>
                        <span className="text-xs font-mono uppercase font-semibold text-emerald-700">
                          {o.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {o.patientAllergenWarnings.length > 0 && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                          {o.patientAllergenWarnings.map((w, idx) => (
                            <p key={idx} className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4 shrink-0" />
                              <span>{w}</span>
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="divide-y divide-slate-100 border-y border-slate-100">
                        {o.items.map((it, idx) => (
                          <div key={idx} className="py-2.5 flex justify-between text-xs">
                            <span className="font-semibold text-slate-900">
                              {it.quantity}x {it.mealName}
                            </span>
                            <span className="font-mono text-slate-600">
                              {it.portionSize} · {it.sodium}mg Na
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-800">
                          Mandatory 4-Point Clinical Quality Gate
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {(
                            [
                              ['portionWeighed', 'Portion Grammage Weighed'],
                              ['allergenCrossCheck', 'Separate Allergen Utensils'],
                              ['sodiumVerified', 'Measured Low-Sodium Salt'],
                              ['tamperSealApplied', 'Tamper-Evident Nutrition Seal'],
                            ] as const
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={o.qualityChecklist[key]}
                                onChange={() => void toggleQcCheck(o, key)}
                                className="rounded border-slate-300 text-emerald-600"
                              />
                              <span className="text-slate-700">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => void advanceOrderStatus(o.id, 'preparing')}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Start Prep
                      </button>
                      <button
                        type="button"
                        onClick={() => void advanceOrderStatus(o.id, 'quality_checked')}
                        className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Mark QC Checked
                      </button>
                      <button
                        type="button"
                        disabled={!allChecksPassed}
                        onClick={() => void advanceOrderStatus(o.id, 'ready_for_dispatch')}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 ml-auto"
                      >
                        Release to Cold-Chain Dispatch
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">{r.name}</h3>
                <span className="text-xs font-mono text-slate-500">
                  {r.portionSize} · {r.prepTimeMins}m
                </span>
              </div>
              <p className="text-xs font-mono text-emerald-700">
                Target: {r.calories} kcal · {r.sodium}mg Sodium
              </p>
              <p className="text-xs text-slate-600">
                <strong>Ingredients:</strong> {r.ingredients.join(', ')}
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 pt-2 border-t border-slate-100">
                {r.recipeSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Clinical Kitchen Ingredient Stock</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Ingredient</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Allergen Zone</th>
                  <th className="py-2 pr-4">Current Stock</th>
                  <th className="py-2 pr-4">Reorder Alert</th>
                  <th className="py-2 text-right">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => {
                  const isLow = item.stockQty <= item.reorderThreshold;
                  return (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{item.ingredientName}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.category}</td>
                      <td className="py-3 pr-4 text-slate-600">{item.allergenGroup || 'Allergen-Free'}</td>
                      <td className="py-3 pr-4 font-mono">
                        <input
                          type="number"
                          value={stockEdits[item.id] ?? item.stockQty}
                          onChange={(e) =>
                            setStockEdits((prev) => ({
                              ...prev,
                              [item.id]: Number(e.target.value),
                            }))
                          }
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                        />{' '}
                        {item.unit}
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        {isLow ? (
                          <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Low (&le;{item.reorderThreshold}{' '}
                            {item.unit})
                          </span>
                        ) : (
                          <span className="text-emerald-700">Sufficient</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleUpdateStock(item)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

// ==========================================
// 2. DELIVERY PARTNER PORTAL + GOOGLE MAPS ROUTES
// ==========================================
interface DeliveryTask {
  id: string;
  orderNumber: string;
  status: string;
  scheduledSlot: string;
  itemCount: number;
  deliveryAddress: {
    label: string;
    recipientName: string;
    phone: string;
    formattedAddress: string;
    postalCode: string;
    lat: number;
    lng: number;
  };
  pickupHub: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  payoutInr: number;
  updatedAt: string;
}

export const DeliveryPortal: React.FC = () => {
  const { pushToast, realtimeTick } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'active';
  const setTab = (tab: string) => setSearchParams({ tab });

  const [partnerProfile, setPartnerProfile] = useState<{
    name: string;
    vehicleType: string;
    vehicleNumber: string;
    isAvailable: boolean;
    totalDeliveries: number;
    totalEarningsInr: number;
  } | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryTask[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const fetchDelivery = useCallback(async () => {
    try {
      const { data } = await api.get('/delivery/dashboard');
      setPartnerProfile(data.partnerProfile || null);
      const list: DeliveryTask[] = data.deliveries || [];
      setDeliveries(list);
      if (list.length > 0 && !selectedOrderId) {
        const activeOne = list.find((d) => d.status !== 'delivered') || list[0];
        setSelectedOrderId(activeOne.id);
      }
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Failed to load Delivery Portal'), 'error');
    }
  }, [pushToast, selectedOrderId]);

  useEffect(() => {
    void fetchDelivery();
  }, [fetchDelivery, realtimeTick]);

  const activeDeliveries = deliveries.filter((d) => d.status !== 'delivered');
  const completedDeliveries = deliveries.filter((d) => d.status === 'delivered');
  const selectedTask = deliveries.find((d) => d.id === selectedOrderId) || activeDeliveries[0] || deliveries[0];

  const navItems: PortalNavItem[] = [
    { id: 'active', label: 'Dispatch & Route Map', icon: <Navigation className="w-4 h-4" />, count: activeDeliveries.length },
    { id: 'earnings', label: 'Earnings & History', icon: <Wallet className="w-4 h-4" />, count: completedDeliveries.length },
  ];

  const toggleAvailability = async () => {
    if (!partnerProfile) return;
    try {
      const { data } = await api.put('/delivery/availability', {
        isAvailable: !partnerProfile.isAvailable,
      });
      setPartnerProfile(data.partnerProfile);
      pushToast(
        `Shift status set to ${data.partnerProfile.isAvailable ? 'Online & Dispatchable' : 'Offline'}`,
        'info'
      );
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  const updateDeliveryStatus = async (
    orderId: string,
    status: 'picked_up' | 'out_for_delivery' | 'delivered'
  ) => {
    try {
      await api.put(`/delivery/orders/${orderId}/status`, { status });
      pushToast(`Order status updated to ${status.replace(/_/g, ' ')}`, 'success');
      await fetchDelivery();
    } catch (err) {
      pushToast(getApiErrorMessage(err), 'error');
    }
  };

  return (
    <PortalLayout
      roleTitle="Cold-Chain Delivery Partner"
      subtitle={
        partnerProfile
          ? `${partnerProfile.vehicleType} (${partnerProfile.vehicleNumber}) · Zero medical PHI shown`
          : 'Insulated clinical meal dispatch & live Google Maps navigation'
      }
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setTab}
      headerAction={
        partnerProfile && (
          <button
            type="button"
            onClick={() => void toggleAvailability()}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              partnerProfile.isAvailable
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {partnerProfile.isAvailable ? 'Shift Online' : 'Shift Offline'}
          </button>
        )
      }
    >
      {activeTab === 'active' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Assigned Dispatch Runs ({activeDeliveries.length})
            </h2>
            {deliveries.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedOrderId(d.id)}
                className={`rounded-xl border p-5 space-y-3 cursor-pointer transition-colors ${
                  selectedTask?.id === d.id
                    ? 'border-emerald-600 bg-white shadow-xs'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold font-mono text-slate-900">{d.orderNumber}</span>
                  <span className="text-xs font-mono uppercase text-emerald-700">
                    {d.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {d.deliveryAddress.recipientName} ({d.deliveryAddress.phone}) —{' '}
                    {d.deliveryAddress.formattedAddress}
                  </span>
                </p>
                <p className="text-xs font-mono text-slate-500">
                  Slot {d.scheduledSlot} · {d.itemCount} insulated tray(s) · Payout ₹{d.payoutInr}
                </p>

                {d.status !== 'delivered' && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void updateDeliveryStatus(d.id, 'picked_up');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Confirm Pickup
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void updateDeliveryStatus(d.id, 'out_for_delivery');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Out for Delivery
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void updateDeliveryStatus(d.id, 'delivered');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                    >
                      Mark Delivered
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Live Dispatch Navigation (Google Maps Routes API)
              </h2>
            </div>
            {selectedTask ? (
              <DeliveryRouteMap
                pickup={{
                  lat: selectedTask.pickupHub.lat,
                  lng: selectedTask.pickupHub.lng,
                  label: selectedTask.pickupHub.name,
                }}
                dropoff={{
                  lat: selectedTask.deliveryAddress.lat,
                  lng: selectedTask.deliveryAddress.lng,
                  label: `${selectedTask.deliveryAddress.recipientName} (${selectedTask.deliveryAddress.label})`,
                }}
              />
            ) : (
              <p className="text-xs text-slate-500">Select a delivery run to calculate driving route.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'earnings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Completed Cold-Chain Runs</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {partnerProfile?.totalDeliveries ?? completedDeliveries.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Cumulative Partner Earnings</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                ₹{partnerProfile?.totalEarningsInr ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Standard Payout per Verified Drop</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">₹75</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Completed Delivery Ledger</h3>
            {completedDeliveries.length === 0 ? (
              <p className="text-xs text-slate-500">No deliveries marked completed in this session yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs font-mono tabular-nums">
                {completedDeliveries.map((d) => (
                  <div key={d.id} className="py-3 flex justify-between">
                    <span>
                      {d.orderNumber} — {d.deliveryAddress.formattedAddress}
                    </span>
                    <span className="text-emerald-700 font-semibold">+₹{d.payoutInr}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </PortalLayout>
  );
};

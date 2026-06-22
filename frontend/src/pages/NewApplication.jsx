import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, Plane, Calendar, User, Search, 
  CreditCard, Loader2, CheckCircle, ArrowLeft, ArrowRight, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import IOSSelect from '../components/IOSSelect';

const NewApplication = () => {
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState([]);
  const [visaTypes, setVisaTypes] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    country_id: '', visa_type_id: '', 
    intended_travel_date: '', flight_preference: '',
    agent_id: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [c, v, a] = await Promise.all([
          api.get('/lookup/countries'),
          api.get('/lookup/visa-types'),
          api.get('/lookup/agents')
        ]);
        setCountries(c.data);
        setVisaTypes(v.data);
        setAgents(a.data);
      } catch (err) { console.error('Failed to load lookup data:', err); }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'visa_type_id') {
        const v = visaTypes.find(vt => vt.visa_type_id === parseInt(value));
        if (v) newData.duration = v.duration_days || 30;
      }
      return newData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/applicant/application', formData);
      setStep(4); // Success step
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit application. Please check your network or inputs.');
    } finally {
      setLoading(false);
    }
  };

  const selectedVisa = visaTypes.find(v => v.visa_type_id === parseInt(formData.visa_type_id));

  return (
    <DashboardLayout role="applicant">
      <div className="max-w-4xl mx-auto animate-fade">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black mb-1">New Visa Application</h1>
            <p className="text-xs text-blue-200/50 uppercase font-bold tracking-tighter">Follow the steps to submit your application</p>
          </div>
          <button onClick={() => navigate('/applicant')} className="flex items-center gap-2 text-blue-400 text-sm font-bold hover:underline transition-all">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </header>

        {/* Step Progress */}
        <div className="flex justify-between items-center mb-8 px-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${
                step >= s ? 'bg-blue-500 text-blue-950 shadow-lg' : 'bg-white/5 text-blue-200/50'
              }`}>
                {step > s ? <CheckCircle size={20} /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 mx-4 rounded-full ${step > s ? 'bg-blue-500' : 'bg-white/5'}`}></div>}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card space-y-6"
              >
                <h2 className="text-xl font-black flex items-center gap-3">
                  <Globe className="text-blue-400" /> Destination & Visa Type
                </h2>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label>Where are you traveling to?</label>
                    <IOSSelect 
                      placeholder="Select Country"
                      value={formData.country_id}
                      onChange={(val) => handleSelectChange('country_id', val)}
                      options={countries.map(c => ({ value: c.country_id, label: c.country_name }))}
                      icon={Globe}
                    />
                  </div>
                  <div className="space-y-2">
                    <label>Visa Category</label>
                    <IOSSelect 
                      placeholder="Select Visa Type"
                      value={formData.visa_type_id}
                      onChange={(val) => handleSelectChange('visa_type_id', val)}
                      options={visaTypes.map(v => ({ value: v.visa_type_id, label: `${v.visa_name} - $${v.base_fee}` }))}
                      icon={Plane}
                    />
                  </div>
                </div>
                {selectedVisa && (
                  <div className="bg-blue-500/5 p-4 rounded-2xl border border-white/10">
                    <h4 className="font-bold text-blue-400 mb-1 text-sm">Visa Details:</h4>
                    <p className="text-xs text-blue-200/50">{selectedVisa.description}</p>
                    <div className="flex gap-6 mt-4">
                      <div className="text-xs">
                        <span className="text-blue-200/30 block uppercase font-bold text-[10px]">Duration</span>
                        <span className="font-bold text-white">{selectedVisa.duration_days} Days</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-blue-200/30 block uppercase font-bold text-[10px]">Base Fee</span>
                        <span className="font-bold text-green-400">${selectedVisa.base_fee}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-4">
                  <button type="button" onClick={() => setStep(2)} disabled={!formData.country_id || !formData.visa_type_id} className="btn btn-primary px-8">
                    Next Step <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card space-y-6"
              >
                <h2 className="text-xl font-black flex items-center gap-3">
                  <Plane className="text-blue-400" /> Travel Information
                </h2>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label>Intended Travel Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/40" size={18} />
                      <input 
                        name="intended_travel_date" 
                        type="date" 
                        className="pl-12" 
                        value={formData.intended_travel_date} 
                        onChange={handleChange} 
                        min={new Date().toISOString().split('T')[0]}
                        required 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label>Stay Duration (Days)</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/40" size={18} />
                      <input name="duration" type="number" className="pl-12" placeholder="e.g. 30" value={formData.duration || (selectedVisa ? selectedVisa.duration_days : 30)} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label>Flight Preference (Optional)</label>
                    <input name="flight_preference" placeholder="e.g. Emirates, Qatar Airways" value={formData.flight_preference} onChange={handleChange} />
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  <button type="button" onClick={() => setStep(1)} className="btn btn-secondary px-8">
                    <ArrowLeft size={18} /> Previous
                  </button>
                  <button type="button" onClick={() => setStep(3)} disabled={!formData.intended_travel_date} className="btn btn-primary px-8">
                    Next Step <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card space-y-6"
              >
                <h2 className="text-xl font-black flex items-center gap-3">
                  <User className="text-blue-400" /> Select Your Agent
                </h2>
                <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {agents.map(agent => (
                    <div 
                      key={agent.agent_id}
                      onClick={() => setFormData({ ...formData, agent_id: agent.agent_id })}
                      className={`flex justify-between items-center p-4 rounded-2xl border transition-all cursor-pointer ${
                        formData.agent_id === agent.agent_id ? 'bg-blue-500/10 border-blue-500 shadow-lg' : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-black">
                          {agent.first_name[0]}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-sm text-white">{agent.first_name} {agent.last_name}</h4>
                          <div className="flex items-center gap-4 text-[10px] text-blue-200/50 mt-1 uppercase font-black tracking-widest">
                            <span className="flex items-center gap-1 text-yellow-400">★ {agent.rating} ({agent.total_ratings})</span>
                            <span>{agent.experience_years} Years Exp.</span>
                            <span className="text-green-400 font-black">${agent.hourly_fee}/hr</span>
                          </div>
                          {agent.bio && (
                            <p className="text-[11px] text-blue-200/60 mt-3 italic leading-relaxed line-clamp-2 border-l border-blue-500/30 pl-3">
                              "{agent.bio}"
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        formData.agent_id === agent.agent_id ? 'border-primary bg-primary text-white' : 'border-glass-border'
                      }`}>
                        {formData.agent_id === agent.agent_id && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-4">
                  <button type="button" onClick={() => setStep(2)} className="btn btn-secondary px-8">
                    <ArrowLeft size={18} /> Previous
                  </button>
                  <button type="submit" disabled={loading} className="btn bg-green-500 hover:bg-green-600 text-blue-950 px-8">
                    {loading ? <Loader2 className="animate-spin" /> : <CheckCircle size={18} />}
                    Submit Application
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card py-16 text-center flex flex-col items-center"
              >
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-6">
                  <CheckCircle size={48} />
                </div>
                <h2 className="text-2xl font-black mb-3">Application Submitted!</h2>
                <p className="text-blue-200/50 max-w-md mb-8 text-sm font-bold">
                  Your application for {selectedVisa?.visa_name} has been successfully submitted. 
                  Our team and your assigned agent will review it shortly.
                </p>
                <button onClick={() => navigate('/applicant')} className="btn btn-primary px-10">
                  Go to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--glass-border); border-radius: 10px; }
      `}</style>
    </DashboardLayout>
  );
};

export default NewApplication;

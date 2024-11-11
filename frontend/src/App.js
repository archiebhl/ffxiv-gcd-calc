import React, { useState } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
    const [gcd, setGcd] = useState('');
    const [lodestoneID, setLodestoneID] = useState('');
    const [gcdResult, setGcdResult] = useState(null);
    const [characterResult, setCharacterResult] = useState(null);

    const handleGcdSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:8000/calculate', { gcd: parseFloat(gcd) });
            setGcdResult(response.data);
        } catch (error) {
            console.error("Error fetching GCD data: ", error);
        }
    };

    const handleLodestoneSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('http://localhost:8000/search', { lodestoneID });
            setCharacterResult(response.data);
        } catch (error) {
            console.error("Error fetching character data: ", error);
        }
    };

    return (
        <div className="container mt-5">
            <h1 className="text-center">FFXIV GCD Calculator</h1>

            {/* Lodestone ID Search Form */}
            <form onSubmit={handleLodestoneSubmit} className="mb-4">
                <div className="form-group">
                    <input
                        type="text"
                        className="form-control"
                        value={lodestoneID}
                        onChange={(e) => setLodestoneID(e.target.value)}
                        placeholder="Enter Lodestone ID"
                        required
                    />
                </div>
                <button type="submit" className="btn btn-secondary">Search Character</button>
            </form>

            {/* Character Result */}
            {characterResult && (
                <div className="row mb-4">
                    {/* Character Details Column */}
                    <div className="col-md-4">
                        <h2>Character Details:</h2>
                        <p><strong>Name:</strong> {characterResult.name}</p>
                        <img
                            src={characterResult.portraitUrl}
                            alt={`${characterResult.name}'s Avatar`}
                            className="img-fluid mb-2"
                        />
                        <p><strong>Skill Speed:</strong> {characterResult.stats.skillspeed}</p>
                    </div>

                    {/* Equipment Column */}
                    <div className="col-md-8">
                        <h3>Equipment:</h3>
                        <div className="row">
                            {characterResult.equipment.map((item, index) => (
                                <div key={index} className="col-6 mb-2">
                                    <div className="list-group-item d-flex justify-content-between align-items-center">
                                        <div>
                                            <strong>{item.slot}:</strong> {item.name}
                                        </div>
                                        <img src={item.image} alt={item.name} style={{ width: '50px', height: '50px' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* GCD Calculation Form and Results */}
            {characterResult && (
                <div className="d-flex justify-content-center mb-4">
                    <div className="w-100">
                        {/* GCD Calculation Form */}
                        <form onSubmit={handleGcdSubmit} className="mb-4">
                            <div className="form-group">
                                <input
                                    type="number"
                                    className="form-control"
                                    value={gcd}
                                    onChange={(e) => setGcd(e.target.value)}
                                    placeholder="Enter desired GCD"
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary">Calculate</button>
                        </form>

                        {/* GCD Results */}
                        {gcdResult && (
                            <div className="card mb-4">
                                <div className="card-body">
                                    <h2>GCD Results:</h2>
                                    <p><strong>Required Skill Speed:</strong> {gcdResult.skillspeed}</p>
                                    <h3>Other Durations:</h3>
                                    
                                    {/* Table for Other Durations */}
                                    <table className="table table-bordered">
                                        <thead>
                                            <tr>
                                                <th>Original GCD</th>
                                                <th>New GCD</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gcdResult.otherGCDs && Object.entries(gcdResult.otherGCDs).map(([originalGCD, newGCD], index) => (
                                                <tr key={index}>
                                                    <td>{originalGCD}s</td>
                                                    <td>{newGCD}s</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
